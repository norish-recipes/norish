export type CompatibleMessageTranslator = (messageId: string) => string;

type ScopedMessageTranslator = (messageKey: string) => string;

export function createIntlMessageTranslator(
  formatMessage: (descriptor: { id: string }) => string
): CompatibleMessageTranslator {
  return (messageId) => formatMessage({ id: messageId });
}

export function createScopedMessageTranslator(
  translators: Record<string, ScopedMessageTranslator>
): CompatibleMessageTranslator {
  return (messageId) => {
    const [scope, ...rest] = messageId.split(".");

    if (!scope || rest.length === 0) {
      return messageId;
    }

    const translate = translators[scope];

    if (!translate) {
      return messageId;
    }

    return translate(rest.join("."));
  };
}
