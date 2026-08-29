import { GuildCliente } from './GuildCliente';

/* A guild é resolvida no cliente porque a primeira coisa que a página faz é
   perguntar quem é você — e a resposta depende do cookie, não da URL. */
export default async function PaginaGuild({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GuildCliente slug={slug} />;
}
