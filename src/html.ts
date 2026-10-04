// The only way to build markup. A string that is interpolated gets escaped.
// Markup that html already built is inserted as it is.

export class Html {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }
}

type Value = string | number | Html | readonly Value[];

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

function render(value: Value): string {
  if (value instanceof Html) return value.text;
  if (typeof value === 'string') return escape(value);
  if (typeof value === 'number') return String(value);
  return value.map(render).join('');
}

export function html(strings: TemplateStringsArray, ...values: Value[]): Html {
  let text = strings[0] ?? '';
  values.forEach((value, index) => {
    text += render(value) + (strings[index + 1] ?? '');
  });
  return new Html(text);
}
