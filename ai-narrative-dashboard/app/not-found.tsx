import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-5 px-5 text-center">
      <p className="text-sm text-muted-foreground">Ошибка 404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="text-muted-foreground">Возможно, адрес изменился. Вернитесь на главную, чтобы продолжить работу с данными.</p>
      <Link href="/" className="rounded-xl bg-primary px-5 py-3 text-sm text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">На главную</Link>
    </main>
  );
}
