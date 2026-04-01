import { Link } from "react-router-dom";
import { Users, Cpu, Clock, Coins, Plug, Building2, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Users, title: "Time Autônomo", desc: "Agentes debatem e decidem juntos, como um time real." },
  { icon: Cpu, title: "Multi-Modelo de IA", desc: "Claude, GPT-4o, Gemini, Llama — escolha o melhor para cada agente." },
  { icon: Clock, title: "Agendamentos", desc: "Workflows que rodam sozinhos, no horário que você definir." },
  { icon: Coins, title: "Créditos Flexíveis", desc: "Pague só pelo que usar. Sem surpresas na fatura." },
  { icon: Plug, title: "Integrações", desc: "Conecte Google, WhatsApp, Instagram e mais." },
  { icon: Building2, title: "White Label", desc: "Revenda para seus clientes com sua marca." },
];

const steps = [
  { icon: Building2, title: "Configure seu escritório", desc: "Defina missão, produtos e cultura" },
  { icon: Users, title: "Contrate seus agentes", desc: "Escolha especialidades e modelos de IA" },
  { icon: Zap, title: "Deixe eles trabalharem", desc: "Assista seu time de IA em ação" },
];

const plans = [
  {
    name: "Starter",
    price: "Grátis",
    sub: "para começar",
    features: ["500 créditos iniciais", "Até 3 agentes", "Funcionalidades básicas"],
    cta: "Começar grátis",
    popular: false,
  },
  {
    name: "Pro",
    price: "R$119",
    sub: "/mês",
    features: ["5.000 créditos/mês", "Agentes ilimitados", "CEO Autônomo", "Todas as integrações"],
    cta: "Assinar Pro",
    popular: true,
  },
  {
    name: "Business",
    price: "R$299",
    sub: "/mês",
    features: ["15.000 créditos/mês", "White label", "Suporte prioritário", "API access"],
    cta: "Falar com vendas",
    popular: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glassmorphism">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <span className="text-xl font-bold gradient-text">Octonfy</span>
          <div className="flex gap-3">
            <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
            <Button className="gradient-cta border-0" asChild><Link to="/register">Criar conta</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center dot-grid-animated pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none" />
        <div className="relative z-10 container mx-auto px-6 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent mb-8 glow-neon">
            <span>✦</span> Novo — Escritório de IA autônomo
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="gradient-text">Seu time de IA que nunca para de trabalhar</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Monte uma equipe de agentes autônomos, cada um com sua especialidade, trabalhando juntos enquanto você foca no que importa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gradient-cta border-0 text-lg px-8 h-12" asChild>
              <Link to="/register">Criar meu escritório grátis</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-border" asChild>
              <a href="#como-funciona">Ver como funciona</a>
            </Button>
          </div>

          {/* Office Mockup */}
          <div className="mt-16 rounded-xl border border-border bg-card/50 p-8 glassmorphism">
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: "CEO", color: "#6366f1" },
                { name: "Marketing", color: "#3b82f6" },
                { name: "Vendas", color: "#22c55e" },
              ].map((a) => (
                <div key={a.name} className="rounded-lg border border-border bg-card p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: a.color }}>
                    {a.name[0]}
                  </div>
                  <span className="text-sm font-medium">{a.name}</span>
                  <span className="text-xs text-muted-foreground">Trabalhando...</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 container mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 gradient-text">Tudo que seu time precisa</h2>
        <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">Funcionalidades pensadas para que seus agentes de IA trabalhem como um time real.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 transition-all hover:glow-neon group">
              <f.icon className="h-10 w-10 text-primary mb-4 group-hover:text-accent transition-colors" />
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-24 container mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 gradient-text">Como funciona</h2>
        <div className="flex flex-col md:flex-row items-start justify-center gap-8 relative">
          <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary to-accent" />
          {steps.map((s, i) => (
            <div key={s.title} className="flex-1 text-center relative z-10">
              <div className="mx-auto w-24 h-24 rounded-full border-2 border-primary bg-card flex items-center justify-center mb-4 glow-neon">
                <s.icon className="h-10 w-10 text-primary" />
              </div>
              <span className="text-sm text-primary font-semibold mb-2 block">Passo {i + 1}</span>
              <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
              <p className="text-muted-foreground text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section className="py-24 container mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 gradient-text">Planos</h2>
        <p className="text-muted-foreground text-center mb-16">Escolha o plano ideal para o tamanho do seu time.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl border p-8 flex flex-col relative ${
                p.popular ? "border-accent glow-neon bg-card" : "border-border bg-card"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full gradient-cta text-white">
                  Mais Popular
                </span>
              )}
              <h3 className="text-xl font-bold mb-1">{p.name}</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.sub}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button className={p.popular ? "gradient-cta border-0 w-full" : "w-full"} variant={p.popular ? "default" : "outline"} asChild>
                <Link to="/register">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© 2025 Octonfy. Todos os direitos reservados.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Termos</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="#" className="hover:text-foreground transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
