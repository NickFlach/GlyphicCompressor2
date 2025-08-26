import { queryClient } from "./queryClient";

export { apiRequest } from "./queryClient";

export const invalidateQueries = (queryKey: string[]) => {
  queryClient.invalidateQueries({ queryKey });
};

export const setQueryData = (queryKey: string[], data: any) => {
  queryClient.setQueryData(queryKey, data);
};
