/**
 * React Router 5 and React Redux 8 expose HOCs, while this application applies
 * the same functions as legacy class decorators. Keep that unavoidable type
 * bridge localized until decorator syntax is removed from the application.
 */
export function asLegacyClassDecorator(decorator: unknown): ClassDecorator {
  return decorator as ClassDecorator;
}
