import { describe, it, expect, vi } from 'vitest';
import { validate } from './validate.js';
import { userSchemas, chatSchemas, creditSchemas } from '../validators/schemas.js';

/* Minimal Express doubles — enough to observe which branch the middleware took
   without standing up an app. */
const mockRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

const run = (schemas, req) => {
  const res = mockRes();
  const next = vi.fn();
  validate(schemas)(req, res, next);
  return { res, next };
};

describe('validate', () => {
  it('passes a well-formed body through and normalises it', () => {
    const req = { body: { email: '  USER@Example.COM ', password: 'Secret1!' } };
    const { res, next } = run(userSchemas.login, req);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
    // Trimmed and lower-cased, so the handler can look the address up directly.
    expect(req.body.email).toBe('user@example.com');
  });

  it('rejects a Mongo operator object where a string is expected', () => {
    // The injection guard: without it this reaches findOne as {$ne: null} and
    // matches the first user in the collection.
    const req = { body: { email: { $ne: null }, password: { $ne: null } } };
    const { res, next } = run(userSchemas.login, req);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('strips unknown keys rather than failing', () => {
    // Login and register share a form, so login posts a name field too.
    const req = { body: { email: 'a@b.co', password: 'x', name: 'ignored' } };
    const { res, next } = run(userSchemas.login, req);

    expect(next).toHaveBeenCalled();
    expect(req.body.name).toBeUndefined();
  });

  it('rejects a malformed ObjectId before it can raise a CastError', () => {
    const { res, next } = run(chatSchemas.byId, { params: { id: 'not-an-id' } });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('accepts a valid ObjectId', () => {
    const { next } = run(chatSchemas.byId, { params: { id: '0123456789abcdef01234567' } });
    expect(next).toHaveBeenCalled();
  });

  it('rejects a plan id outside the known set', () => {
    const { res } = run(creditSchemas.purchase, { body: { planId: 'free-unlimited' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid plan selected');
  });

  it('coerces a numeric query string and enforces its bounds', () => {
    const ok = run(chatSchemas.get, { query: { limit: '25' } });
    expect(ok.next).toHaveBeenCalled();

    const tooMany = run(chatSchemas.get, { query: { limit: '5000' } });
    expect(tooMany.res.statusCode).toBe(400);
  });

  it('leaves req.query untouched, since Express 5 exposes it as a getter', () => {
    const req = { query: { limit: '10' } };
    const original = req.query;
    run(chatSchemas.get, req);
    expect(req.query).toBe(original);
  });

  it('treats a missing body as empty rather than throwing', () => {
    const { res } = run(userSchemas.login, {});
    expect(res.statusCode).toBe(400);
  });

  it('requires a six-digit OTP', () => {
    expect(run(userSchemas.verifyOtp, { body: { email: 'a@b.co', otp: '123' } }).res.statusCode).toBe(400);
    expect(run(userSchemas.verifyOtp, { body: { email: 'a@b.co', otp: '123456' } }).next).toHaveBeenCalled();
  });
});
