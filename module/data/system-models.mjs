import definitions from "./document-defaults.json" with { type: "json" };

// Preserve open-ended rule maps and legacy formula/string values during this migration.
export function withDefaults(defaults, value) {
  if (value === undefined) return structuredClone(defaults);
  if (!defaults || !value || Array.isArray(defaults) || Array.isArray(value)
    || typeof defaults !== "object" || typeof value !== "object") return structuredClone(value);
  const result = structuredClone(value);
  for (const [key, initial] of Object.entries(defaults)) result[key] = withDefaults(initial, value[key]);
  return result;
}

export function documentDefaults(kind, type) {
  const { templates = [], ...own } = definitions[kind][type];
  let defaults = {};
  for (const name of templates) defaults = withDefaults(defaults, definitions[kind].templates[name]);
  return withDefaults(defaults, own);
}

export function registerSystemDataModels() {
  const { DataField, ObjectField, ArrayField, SchemaField, NumberField } = foundry.data.fields;
  class ResourceSchemaField extends SchemaField {
    initialize(value, model, options) {
      return Object.assign(structuredClone(value ?? {}), super.initialize(value, model, options));
    }

    toObject(value) {
      return Object.assign(structuredClone(value ?? {}), super.toObject(value));
    }
  }
  function resourceSchema(initial) {
    return new ResourceSchemaField(Object.fromEntries(Object.entries(initial).map(([key, value]) => [key,
      typeof value === "number" ? new NumberField({ required: true, initial: value }) : resourceSchema(value),
    ])));
  }
  class DefaultObjectField extends ObjectField {
    _cleanType(value, options, state) {
      const cleaned = super._cleanType(value, options, state);
      // Never fill an update delta: it would reset unrelated saved resources.
      return options.partial ? cleaned : withDefaults(this.getInitialValue(), cleaned);
    }
  }
  for (const kind of ["Actor", "Item"]) {
    CONFIG[kind].dataModels ??= {};
    for (const type of definitions[kind].types) {
      const defaults = documentDefaults(kind, type);
      CONFIG[kind].dataModels[type] = class extends foundry.abstract.TypeDataModel {
        static cleanData(data, options = {}, state = {}) {
          return super.cleanData(data, { ...options, prune: false }, state);
        }

        static defineSchema() {
          return Object.fromEntries(Object.entries(defaults).map(([key, initial]) => {
            // Typed resource leaves keep token bars and the Token HUD editable.
            if (kind === "Actor" && key === "resources") return [key, resourceSchema(initial)];
            const options = { required: true, nullable: true, initial: () => structuredClone(initial) };
            const field = Array.isArray(initial) ? new ArrayField(new DataField({ nullable: true }), options)
              : initial && typeof initial === "object" ? new DefaultObjectField(options) : new DataField(options);
            return [key, field];
          }));
        }

        _initialize(options) {
          super._initialize(options);
          // Existing worlds and homebrew items may carry additional rule fields.
          for (const [key, value] of Object.entries(this._source)) {
            if (!(key in defaults) && !(key in this.constructor.prototype)) this[key] = structuredClone(value);
          }
        }

        toObject(source = true) {
          const data = super.toObject(source);
          if (!source) for (const key of Object.keys(this._source)) {
            if (!(key in defaults)) data[key] = structuredClone(this[key]);
          }
          return data;
        }
      };
    }
  }
}
