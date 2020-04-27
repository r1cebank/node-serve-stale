export type ResponseHandler = {
  [key: string]: [(response: unknown) => void];
};
