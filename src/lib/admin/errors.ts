/** An expected failure with a message fit to show the admin as-is. */
export class AdminError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AdminError";
  }
}
