import { z } from 'zod';

const ingredientSchema = z.tuple([
  z.string().trim().min(1).max(120),
  z.string().trim().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/).refine(value => Number(value) > 0),
  z.string().trim().min(1).max(20),
]);

export const recipeSchema = z.strictObject({
  name: z.string().trim().min(2, 'Escribe un nombre de al menos 2 caracteres.').max(120, 'El nombre admite hasta 120 caracteres.'),
  description: z.string().trim().min(1, 'Escribe una descripción.').max(500, 'La descripción admite hasta 500 caracteres.'),
  preparation: z.string().trim().min(1, 'Escribe al menos un paso.').max(3000, 'La preparación admite hasta 3000 caracteres.'),
  ingredients: z.string().transform((value, ctx) => {
    const lines = value.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 1 || lines.length > 20) {
      ctx.addIssue({ code: 'custom', message: 'Escribe entre 1 y 20 ingredientes.' });
      return z.NEVER;
    }
    return lines.map((line, index) => {
      const result = ingredientSchema.safeParse(line.split('|'));
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          message: `Revisa el ingrediente ${index + 1}. Usa nombre | cantidad positiva con hasta 3 decimales | unidad.`,
        });
        return z.NEVER;
      }
      const [name, quantity, unit] = result.data;
      return { name, quantity, unit };
    });
  }),
});
