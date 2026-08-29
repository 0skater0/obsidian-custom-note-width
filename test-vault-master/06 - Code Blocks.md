---
custom-width: 49
---

# Code Blocks — Independent Width

This note shows the **code block width** feature. The editor runs at 50%, but code blocks can have their own width — configure it under **Settings → Custom Note Width → Enable code block width**.

## Enable the feature

1. Open settings and turn on *Enable code block width*
2. Set the code block width (e.g. `940px`)
3. Choose which modes should apply it (reading, source, live preview)

## Short code block

```javascript
const x = 42;
console.log(x);
```

## Long code that would otherwise wrap

```typescript
export function calculateNoteWidth(widthPercentage: number, editorDiv: Element, charWidth: number): number {
    return charWidth * (1 + (widthPercentage / 100) * (editorDiv.clientWidth / charWidth - 1));
}

export function validateWidthValue(wv: WidthValue, unitConfig: UnitConfig): WidthValue {
    return { value: Math.min(unitConfig.max, Math.max(unitConfig.min, wv.value)), unit: wv.unit };
}
```

## Regular paragraph between blocks

This text stays at 50% editor width. Only the code blocks above and below expand to the configured code block width.

```python
class DataProcessor:
    def __init__(self, config: dict, database_connection_string: str, max_retries: int = 3, timeout_seconds: float = 30.0):
        self.config = config
        self.db_conn = database_connection_string
        self.max_retries = max_retries
        self.timeout = timeout_seconds
```
