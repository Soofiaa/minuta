// Copia de frontend/src/lib/markdown.js: la exportación debe ser idéntica en ambas apps.
export const generateMarkdown = (title, date, notes) => {
  let md = `# ${title}\n\n`;
  if (date) md += `**Fecha:** ${date}\n\n`;
  if (notes.participantes?.length) md += `**Participantes:** ${notes.participantes.join(', ')}\n\n`;

  if (notes.resumen?.length) {
    md += `## Resumen\n\n${notes.resumen.map(r => `- ${r}`).join('\n')}\n\n`;
  }

  if (notes.temas?.length) {
    md += `## Temas tratados\n\n${notes.temas.map(t => `- **${t.tema}** (${t.menciones} menciones)`).join('\n')}\n\n`;
  }

  if (notes.decisiones?.length) {
    md += `## Decisiones\n\n${notes.decisiones.map(d => `- ${d.texto} ${d.hablante ? `— ${d.hablante}` : ''}`).join('\n')}\n\n`;
  }

  if (notes.pendientes?.length) {
    md += `## Pendientes\n\n${notes.pendientes.map(p => `- [${p.hecho ? 'x' : ' '}] ${p.texto} ${p.responsable ? `— Responsable: ${p.responsable}` : ''} ${p.fecha ? `— Fecha: ${p.fecha}` : ''}`).join('\n')}\n\n`;
  }

  if (notes.preguntas?.length) {
    md += `## Preguntas abiertas\n\n${notes.preguntas.map(q => `- ${q}`).join('\n')}\n\n`;
  }

  md += "---\n_Generado con Minuta._";
  return md;
};
