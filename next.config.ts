import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* O Next 16 gera AGENTS.md e CLAUDE.md na raiz a cada `next dev`. São notas
     para ferramentas de IA, não documentação do projeto — desligado para não
     reaparecerem no repo. */
  agentRules: false,
};

export default nextConfig;
