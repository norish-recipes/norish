type MessageValues = Record<string, string | number>;

export type CompatibleMessageTranslator = (messageId: string, values?: MessageValues) => string;

type ScopedMessageTranslator = (messageKey: string, values?: MessageValues) => string;

export function createIntlMessageTranslator(
  formatMessage: (descriptor: { id: string }, values?: MessageValues) => string
): CompatibleMessageTranslator {
  return (messageId, values) => formatMessage({ id: messageId }, values);
}

export function createScopedMessageTranslator(
  translators: Record<string, ScopedMessageTranslator>
): CompatibleMessageTranslator {
  return (messageId, values) => {
    const [scope, ...rest] = messageId.split(".");

    if (!scope || rest.length === 0) {
      return messageId;
    }

    const translate = translators[scope];

    if (!translate) {
      return messageId;
    }

    return translate(rest.join("."), values);
  };
}
