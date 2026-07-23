Deno.serve(async (req) => {
  try {
    const { query } = await req.json();
    if (!query) return Response.json({ error: "query required" }, { status: 400 });

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("TAVILY_API_KEY")}`,
      },
      body: JSON.stringify({
        query: `${query} clinic doctor office phone number address`,
        max_results: 8,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Search failed: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const phoneRe = /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g;
    const results = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: (r.content || "").slice(0, 320),
      phones: [...new Set(((r.content || "").match(phoneRe) || []).slice(0, 3))],
    }));

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});