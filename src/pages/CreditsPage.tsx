import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeCredits } from "@/hooks/useRealtimeCredits";
import { useRealtimeAgents } from "@/hooks/useRealtimeAgents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle, Check, Loader2, Download,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart,
} from "recharts";

const MODEL_COLORS: Record<string, string> = {
  "claude-haiku": "#22c55e",
  "llama-groq": "#f59e0b",
  "gemini-pro": "#06b6d4",
  "claude-sonnet": "#6366f1",
  "gpt-4o": "#3b82f6",
  "claude-opus": "#a855f7",
};

const PACKAGES = [
  { name: "Starter", credits: 1000, price: 29, benefits: ["~125 mensagens com Claude Sonnet", "Ideal para testar o sistema"], popular: false },
  { name: "Pro", credits: 5000, price: 119, benefits: ["~625 mensagens com Claude Sonnet", "Ideal para uso regular", "Melhor custo-benefício"], popular: true, saving: "18%" },
  { name: "Business", credits: 15000, price: 299, benefits: ["~1.875 mensagens com Claude Sonnet", "Times maiores", "Uso intensivo"], popular: false, saving: "31%" },
  { name: "Enterprise", credits: 50000, price: 799, benefits: ["~6.250 mensagens com Claude Sonnet", "Máxima capacidade", "Melhor preço por crédito"], popular: false, saving: "45%" },
];

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  purchase: { label: "Compra", color: "#22c55e" },
  consumption: { label: "Consumo", color: "#94a3b8" },
  refund: { label: "Reembolso", color: "#3b82f6" },
  bonus: { label: "Bônus", color: "#f59e0b" },
};

function timeAgo(d: string | null) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function CreditsPage() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { credits, loading: creditsLoading } = useRealtimeCredits(workspace?.id);
  const { agents } = useRealtimeAgents(workspace?.id);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30d");
  const [page, setPage] = useState(0);
  const [totalTx, setTotalTx] = useState(0);
  const [buyingPkg, setBuyingPkg] = useState<typeof PACKAGES[0] | null>(null);
  const [buying, setBuying] = useState(false);
  const [agentChart, setAgentChart] = useState<any[]>([]);
  const [modelChart, setModelChart] = useState<any[]>([]);
  const [dailyChart, setDailyChart] = useState<any[]>([]);


  const fetchTransactions = async () => {
    if (!workspace) return;
    setTxLoading(true);

    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[dateRange] || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspace.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .range(page * 20, (page + 1) * 20 - 1);

    if (typeFilter !== "all") query = query.eq("type", typeFilter);

    const { data, count } = await query;
    setTransactions(data || []);
    setTotalTx(count || 0);
    setTxLoading(false);
  };

  const fetchCharts = async () => {
    if (!workspace) return;

    // By agent
    const { data: agentData } = await supabase
      .from("transactions")
      .select("agent_id, amount")
      .eq("workspace_id", workspace.id)
      .eq("type", "consumption");

    if (agentData) {
      const grouped: Record<string, number> = {};
      agentData.forEach((t) => {
        if (t.agent_id) grouped[t.agent_id] = (grouped[t.agent_id] || 0) + t.amount;
      });
      const chart = Object.entries(grouped).map(([id, total]) => {
        const agent = agents.find((a) => a.id === id);
        return { name: agent?.name || "Desconhecido", total, fill: agent?.avatar_color || "#94a3b8" };
      });
      setAgentChart(chart);
    }

    // By model
    const { data: modelData } = await supabase
      .from("transactions")
      .select("model, amount")
      .eq("workspace_id", workspace.id)
      .eq("type", "consumption");

    if (modelData) {
      const grouped: Record<string, number> = {};
      modelData.forEach((t) => {
        if (t.model) grouped[t.model] = (grouped[t.model] || 0) + t.amount;
      });
      setModelChart(Object.entries(grouped).map(([model, value]) => ({ name: model, value, fill: MODEL_COLORS[model] || "#94a3b8" })));
    }

    // Daily (30 days)
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const { data: dailyData } = await supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("workspace_id", workspace.id)
      .eq("type", "consumption")
      .gte("created_at", thirtyAgo.toISOString())
      .order("created_at");

    if (dailyData) {
      const grouped: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        grouped[d.toISOString().split("T")[0]] = 0;
      }
      dailyData.forEach((t) => {
        const day = t.created_at?.split("T")[0] || "";
        if (grouped[day] !== undefined) grouped[day] += t.amount;
      });
      setDailyChart(Object.entries(grouped).map(([date, total]) => ({
        date: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
        total,
      })));
    }
  };

  useEffect(() => { fetchTransactions(); }, [workspace, typeFilter, dateRange, page]);
  useEffect(() => { fetchCharts(); }, [workspace, agents]);

  const creditPercent = credits ? (credits.balance / Math.max(credits.balance + credits.total_consumed, 1)) * 100 : 0;
  const creditColor = creditPercent > 50 ? "#22c55e" : creditPercent > 20 ? "#f59e0b" : "#ef4444";
  const totalPages = Math.ceil(totalTx / 20);

  const handleBuy = async () => {
    if (!buyingPkg || !workspace) return;
    setBuying(true);
    try {
      // Update credits
      await supabase
        .from("credits")
        .update({
          balance: (credits?.balance || 0) + buyingPkg.credits,
          total_purchased: (credits?.total_purchased || 0) + buyingPkg.credits,
        })
        .eq("workspace_id", workspace.id);

      // Log transaction
      await supabase.from("transactions").insert({
        workspace_id: workspace.id,
        type: "purchase",
        amount: buyingPkg.credits,
        description: `Compra pacote ${buyingPkg.name}`,
      });

      // Log event
      await supabase.from("event_logs").insert({
        workspace_id: workspace.id,
        event_type: "credit_purchased",
        actor: "user",
        description: `Compra de ${buyingPkg.credits} créditos (pacote ${buyingPkg.name})`,
      });

      toast({ title: `✓ ${buyingPkg.credits.toLocaleString()} créditos adicionados ao seu saldo!` });
      setBuyingPkg(null);
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const exportCSV = () => {
    const header = "Data,Tipo,Agente,Modelo,Tokens Input,Tokens Output,Créditos,Descrição\n";
    const rows = transactions.map((t) =>
      `${t.created_at},${t.type},${t.agent_id || ""},${t.model || ""},${t.tokens_input || ""},${t.tokens_output || ""},${t.amount},${t.description || ""}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transacoes.csv";
    a.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Créditos</h1>
        <p className="text-muted-foreground">Gerencie seu saldo e histórico de consumo</p>
      </div>

      {/* Balance Card */}
      {creditsLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="rounded-xl border border-border p-6 glow-neon" style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(240 15% 12%))" }}>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Saldo disponível</p>
              <p className="text-5xl font-bold" style={{ color: creditColor }}>
                {credits?.balance?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground">créditos</p>
              <div className="mt-4 h-2 rounded-full overflow-hidden bg-muted">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${creditPercent}%`, background: creditColor }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold">{credits?.total_consumed?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Total consumido</p>
              </div>
              <div>
                <p className="text-xl font-bold">{credits?.total_purchased?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Total comprado</p>
              </div>
              <div>
                <p className="text-xl font-bold">{credits?.reserved?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Reservado agora</p>
              </div>
            </div>
          </div>
          {credits?.updated_at && (
            <p className="text-xs text-muted-foreground mt-4">Última atualização: {timeAgo(credits.updated_at)}</p>
          )}
        </div>
      )}

      {/* Low balance alert */}
      {credits && credits.balance < 100 && (
        <div className="rounded-lg border p-4 flex items-center gap-3" style={{ background: "rgba(239,68,68,0.1)", borderColor: "#ef4444" }}>
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
          <p className="text-sm">Saldo crítico! Seus agentes serão bloqueados quando o saldo chegar a zero.</p>
        </div>
      )}

      {/* Packages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PACKAGES.map((pkg) => (
          <div
            key={pkg.name}
            className={`rounded-xl border p-5 flex flex-col relative ${pkg.popular ? "border-accent glow-neon bg-card" : "border-border bg-card"}`}
          >
            {pkg.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full gradient-cta text-white">
                Mais Popular
              </span>
            )}
            <h3 className="text-lg font-bold">{pkg.name}</h3>
            <p className="text-2xl font-bold mt-2">{pkg.credits.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">créditos</span></p>
            <p className="text-xl font-semibold mt-1">R$ {pkg.price}</p>
            {(pkg as any).saving && (
              <span className="inline-flex self-start text-xs px-2 py-0.5 rounded-full mt-1" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                Economize {(pkg as any).saving}
              </span>
            )}
            <ul className="mt-3 space-y-1.5 flex-1">
              {pkg.benefits.map((b) => (
                <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#22c55e" }} /> {b}
                </li>
              ))}
            </ul>
            <Button
              className={`mt-4 w-full ${pkg.popular ? "gradient-cta border-0" : ""}`}
              variant={pkg.popular ? "default" : "outline"}
              onClick={() => setBuyingPkg(pkg)}
            >
              Comprar
            </Button>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {buyingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setBuyingPkg(null)}>
          <div className="w-full max-w-sm glassmorphism rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Confirmar compra</h2>
            <div className="space-y-3 mb-4">
              <p className="text-sm">Pacote: <strong>{buyingPkg.name}</strong></p>
              <p className="text-sm">Créditos: <strong>{buyingPkg.credits.toLocaleString()}</strong></p>
              <p className="text-sm">Valor: <strong>R$ {buyingPkg.price}</strong></p>
              <div className="border-t border-border pt-3">
                <p className="text-sm">
                  Saldo atual: {credits?.balance?.toLocaleString() || 0} →{" "}
                  <strong style={{ color: "#22c55e" }}>
                    {((credits?.balance || 0) + buyingPkg.credits).toLocaleString()}
                  </strong>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Integração com Stripe em breve. Clique em confirmar para simular a compra.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBuyingPkg(null)}>Cancelar</Button>
              <Button className="flex-1 gradient-cta border-0" onClick={handleBuy} disabled={buying}>
                {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar compra"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Agent */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Consumo por agente (total)</h3>
          {agentChart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentChart} layout="vertical">
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {agentChart.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Model */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Consumo por modelo de IA</h3>
          {modelChart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={modelChart} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name }) => name}>
                  {modelChart.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Consumo diário (últimos 30 dias)</h3>
          {dailyChart.every((d) => d.total === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart}>
                <defs>
                  <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#creditGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">Histórico de transações</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { val: "all", label: "Todos" },
            { val: "purchase", label: "Compras" },
            { val: "consumption", label: "Consumo" },
            { val: "bonus", label: "Bônus" },
          ].map((f) => (
            <button
              key={f.val}
              onClick={() => { setTypeFilter(f.val); setPage(0); }}
              className={`px-3 py-1 rounded-full text-xs ${typeFilter === f.val ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}
            >
              {f.label}
            </button>
          ))}
          <select
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(0); }}
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
        </div>

        {/* Table */}
        {txLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação encontrada</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">Modelo</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2 pr-4">Créditos</th>
                    <th className="py-2">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const badge = TYPE_BADGES[tx.type] || TYPE_BADGES.consumption;
                    return (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2 pr-4 text-xs">{tx.created_at ? new Date(tx.created_at).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-2 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${badge.color}20`, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{tx.model || "—"}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {tx.tokens_input || tx.tokens_output ? `${tx.tokens_input || 0}/${tx.tokens_output || 0}` : "—"}
                        </td>
                        <td className="py-2 pr-4 font-medium">{tx.type === "purchase" ? "+" : "-"}{tx.amount}</td>
                        <td className="py-2 text-xs text-muted-foreground truncate max-w-[200px]">{tx.description || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground flex items-center">
                  {page + 1} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Próxima
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
