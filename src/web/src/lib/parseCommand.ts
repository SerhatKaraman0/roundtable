export type ParsedCommand =
  | { type: 'question'; text: string }
  | { type: 'new-question'; text: string }
  | { type: 'targeted-question'; targetId: 'marx' | 'bakunin' | 'mill'; text: string }
  | { type: 'plain'; text: string };

/**
 * Parse a chat input string to detect slash commands.
 * Commands are case-insensitive and must be at the start of the trimmed input.
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'plain', text: '' };
  }

  // Targeted questions: /question-marx, /question-bakunin, /question-mill
  const targetedMatch = trimmed.match(/^\/question-(marx|bakunin|mill)(?:[:\s]+)(.*)$/i);
  if (targetedMatch) {
    const targetId = targetedMatch[1].toLowerCase() as 'marx' | 'bakunin' | 'mill';
    const text = targetedMatch[2].trim();
    return { type: 'targeted-question', targetId, text };
  }

  // /new-question command
  const newQuestionMatch = trimmed.match(/^\/new-question(?:[:\s]+)(.*)$/i);
  if (newQuestionMatch) {
    const text = newQuestionMatch[1].trim();
    return { type: 'new-question', text };
  }

  // /question command
  const questionMatch = trimmed.match(/^\/question(?:[:\s]+)(.*)$/i);
  if (questionMatch) {
    const text = questionMatch[1].trim();
    return { type: 'question', text };
  }

  // No command detected, treat as plain message
  return { type: 'plain', text: trimmed };
}
