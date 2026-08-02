import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});

const toolDefinitions = [
  {
    type: "function",
    name: "list_tasks",
    description: "查询当前用户的任务。默认排除已软删除任务。",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["待开始", "进行中", "已停滞", "已完成"] },
        owner_name: { type: "string" },
        category: { type: "string", enum: ["work", "personal"] },
        keyword: { type: "string" },
        from: { type: "string", description: "ISO 日期时间" },
        to: { type: "string", description: "ISO 日期时间" },
        include_completed: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "create_task",
    description: "创建一条新任务。title 必填，status 默认待开始。",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        owner_name: { type: "string" },
        status: { type: "string", enum: ["待开始", "进行中", "已停滞", "已完成"] },
        priority: { type: "string", enum: ["重要紧急", "重要不紧急", "紧急不重要", "不紧急不重要"] },
        category: { type: "string", enum: ["work", "personal"] },
        start_at: { type: "string" },
        due_at: { type: "string" },
        latest_update: { type: "string" },
        completion_criteria: { type: "string" }
      },
      required: ["title"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "update_task",
    description: "修改已有任务。只传递需要修改的字段。",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        owner_name: { type: "string" },
        status: { type: "string", enum: ["待开始", "进行中", "已停滞", "已完成"] },
        priority: { type: "string", enum: ["重要紧急", "重要不紧急", "紧急不重要", "不紧急不重要"] },
        category: { type: "string", enum: ["work", "personal"] },
        start_at: { type: "string" },
        due_at: { type: "string" },
        latest_update: { type: "string" },
        completion_criteria: { type: "string" }
      },
      required: ["task_id"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "complete_task",
    description: "将任务标记为已完成，并写入完成时间。",
    parameters: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "delete_task",
    description: "软删除任务。必须先获得用户明确确认，confirmed 才能为 true。",
    parameters: {
      type: "object",
      properties: { task_id: { type: "string" }, confirmed: { type: "boolean" } },
      required: ["task_id", "confirmed"],
      additionalProperties: false
    }
  }
];

const chatToolDefinitions = toolDefinitions.map((tool: any) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
}));

const systemPrompt = `你是 Workplan 个人工作台里的任务助理。
你只能通过工具查询和修改当前用户的数据，不能编造任务状态，也不能直接执行 SQL。
用户说“今天”“明天”“本周”时，以当前日期和 Asia/Shanghai 时区理解。
新增任务时，如果缺少标题之外的信息，使用合理默认值，不要为了非关键字段反复追问。
删除任务、批量修改、改变重要任务截止日期前必须要求用户确认。
每次执行工具后，用简洁中文说明做了什么、结果是什么，以及必要的下一步。`;

function taskPayload(input: Record<string, unknown>) {
  const allowed = ["title", "description", "owner_name", "status", "priority", "category", "start_at", "due_at", "latest_update", "completion_criteria"];
  return Object.fromEntries(allowed.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
}

async function executeTool(name: string, args: Record<string, unknown>, supabase: any, userId: string) {
  if (name === "list_tasks") {
    let query = supabase.from("tasks").select("*").is("archived_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(100);
    if (args.status) query = query.eq("status", args.status);
    if (args.owner_name) query = query.ilike("owner_name", `%${String(args.owner_name)}%`);
    if (args.category) query = query.eq("category", args.category);
    if (args.keyword) query = query.or(`title.ilike.%${String(args.keyword)}%,latest_update.ilike.%${String(args.keyword)}%`);
    if (args.from) query = query.gte("start_at", args.from);
    if (args.to) query = query.lte("due_at", args.to);
    if (args.include_completed !== true) query = query.neq("status", "已完成");
    const { data, error } = await query;
    if (error) throw error;
    return { tasks: data ?? [] };
  }

  if (name === "create_task") {
    const payload = { ...taskPayload(args), user_id: userId };
    const { data, error } = await supabase.from("tasks").insert(payload).select().single();
    if (error) throw error;
    await supabase.from("audit_logs").insert({ user_id: userId, action: "create_task", task_id: data.id, after_data: data });
    return { task: data };
  }

  if (name === "update_task") {
    const taskId = String(args.task_id);
    const { data: before, error: beforeError } = await supabase.from("tasks").select("*").eq("id", taskId).is("archived_at", null).single();
    if (beforeError) throw beforeError;
    const { data, error } = await supabase.from("tasks").update(taskPayload(args)).eq("id", taskId).is("archived_at", null).select().single();
    if (error) throw error;
    await supabase.from("audit_logs").insert({ user_id: userId, action: "update_task", task_id: taskId, before_data: before, after_data: data });
    return { task: data };
  }

  if (name === "complete_task") {
    const taskId = String(args.task_id);
    const { data: before, error: beforeError } = await supabase.from("tasks").select("*").eq("id", taskId).is("archived_at", null).single();
    if (beforeError) throw beforeError;
    const { data, error } = await supabase.from("tasks").update({ status: "已完成", completed_at: new Date().toISOString() }).eq("id", taskId).is("archived_at", null).select().single();
    if (error) throw error;
    await supabase.from("audit_logs").insert({ user_id: userId, action: "complete_task", task_id: taskId, before_data: before, after_data: data });
    return { task: data };
  }

  if (name === "delete_task") {
    if (args.confirmed !== true) return { confirmation_required: true, message: "请先向用户确认是否删除这条任务。" };
    const taskId = String(args.task_id);
    const { data: before, error: beforeError } = await supabase.from("tasks").select("*").eq("id", taskId).is("archived_at", null).single();
    if (beforeError) throw beforeError;
    const { data, error } = await supabase.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", taskId).is("archived_at", null).select().single();
    if (error) throw error;
    await supabase.from("audit_logs").insert({ user_id: userId, action: "delete_task", task_id: taskId, before_data: before, after_data: data });
    return { deleted: true, task_id: taskId };
  }

  throw new Error(`Unsupported tool: ${name}`);
}

function responseText(response: Record<string, unknown>) {
  const message = (response.choices as any[])?.[0]?.message;
  return typeof message?.content === "string" ? message.content : "";
}

async function callOpenAI(messages: unknown[]) {
  const baseUrl = (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: chatToolDefinitions,
      tool_choice: "auto"
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "OpenAI request failed");
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "请先登录" }, 401);
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    let response = await callOpenAI(messages);
    const toolResults: unknown[] = [];
    const assistantMessage = (response.choices as any[])?.[0]?.message;
    const calls = Array.isArray(assistantMessage?.tool_calls) ? assistantMessage.tool_calls : [];

    if (calls.length) {
      const outputs: any[] = [{ role: "assistant", content: assistantMessage.content || null, tool_calls: assistantMessage.tool_calls }];
      for (const call of calls) {
        const args = JSON.parse(call.function?.arguments || "{}");
        const result = await executeTool(call.function?.name, args, supabase, user.id);
        toolResults.push({ name: call.function?.name, result });
        outputs.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      response = await callOpenAI([...messages, ...outputs]);
    }

    const reply = responseText(response) || "我已完成处理，但没有生成文字回复。";
    await supabase.from("chat_messages").insert([{ user_id: user.id, role: "user", content: String(body.message || messages.at(-1)?.content || "") }, { user_id: user.id, role: "assistant", content: reply }]);
    return json({ reply, toolResults });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "服务暂时不可用" }, 500);
  }
});
