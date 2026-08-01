/* ─────────────────────────────────────────────────────────────────────────────
   REQUEST VALIDATION

   Schemas run before the handler, so a controller can assume its inputs already
   have the right shape and no longer has to re-check types inline. That type
   check is also the NoSQL-injection guard: every field is declared a string, so
   an object like {"$ne": null} is rejected at the boundary and can never reach
   a query filter as an operator.

   Only body and params are reassigned with the parsed result — Express 5 exposes
   req.query as a getter, and assigning to it throws.
   ───────────────────────────────────────────────────────────────────────── */

export const validate = (schemas) => (req, res, next) => {
  for (const source of ['body', 'params', 'query']) {
    const schema = schemas[source];
    if (!schema) continue;

    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      // Surface one message: the first issue is the actionable one, and a full
      // dump would echo the payload's shape back to a probing caller.
      const issue = result.error.issues[0];
      return res.status(400).json({
        success: false,
        message: issue?.message || 'Invalid request',
      });
    }

    if (source !== 'query') req[source] = result.data;
  }

  next();
};
