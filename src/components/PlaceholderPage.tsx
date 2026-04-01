interface PlaceholderPageProps {
  title: string;
  icon: React.ReactNode;
}

export default function PlaceholderPage({ title, icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Em construção</p>
    </div>
  );
}
