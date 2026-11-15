import { describe, it, expect } from 'vitest';
import { generateMarkdown } from './markdown';

describe('generateMarkdown', () => {
  it('incluye título, resumen, decisiones y pendientes con responsable', () => {
    const md = generateMarkdown('Revisión semanal', '2026-11-15', {
      participantes: ['María', 'Pedro', 'Ana'],
      resumen: ['Se revisó el rediseño de la intranet.'],
      decisiones: [{ texto: 'Usar el buscador nuevo.', hablante: 'María' }],
      pendientes: [
        { texto: 'Revisar los permisos', responsable: 'Pedro', fecha: 'miércoles', hecho: false },
      ],
    });

    expect(md).toContain('# Revisión semanal');
    expect(md).toContain('## Resumen');
    expect(md).toContain('- Se revisó el rediseño de la intranet.');
    expect(md).toContain('## Decisiones');
    expect(md).toContain('- Usar el buscador nuevo. — María');
    expect(md).toContain('## Pendientes');
    expect(md).toContain('- [ ] Revisar los permisos — Responsable: Pedro — Fecha: miércoles');
  });

  it('marca como hecho los pendientes completados', () => {
    const md = generateMarkdown('Demo', '', {
      pendientes: [{ texto: 'Enviar acta', responsable: 'Ana', fecha: '', hecho: true }],
    });
    expect(md).toContain('- [x] Enviar acta — Responsable: Ana');
  });
});
