# Runbook template

Copy this file into `docs/05-operations/runbooks/` and fill it in.

## <Symptom in one line>

**Severity:** <critical | high | medium | low>
**Typical signal:** <what you see, and where you see it>
**Owner:** <role>

## Symptoms

- <Observable symptom, with the page or query that shows it>
- <Second symptom>

## Likely causes

| Cause | How to confirm quickly |
| --- | --- |
| <Cause 1> | <Check> |
| <Cause 2> | <Check> |

## Immediate mitigation

1. <Step that stops the bleeding, even if it is not the real fix>
2. <Step>

```bash
# Command with its expected output described
```

## Diagnosis

1. <Step>
2. <Step>

## Fix

1. <Step>
2. <Step>

```bash
# Verification command
```

## Verification

- [ ] <Observable outcome that proves the fix>
- [ ] <Second check>

## Prevention

- <Test, guard or monitoring change that would catch this earlier>

## Related

- Issue: <known-issue id if tracked in `docs/03-implementation/current/known-issues.md`>
- ADR: <if the fix involves an architectural decision>
- Files: <paths>
