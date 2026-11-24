import { http, HttpResponse } from "msw";
import { getApiBaseUrl } from "@/lib/api-base";

const apiBaseUrl = getApiBaseUrl();

export const handlers = [
  http.get(`${apiBaseUrl}/missions`, () => HttpResponse.json([])),
  http.get(`${apiBaseUrl}/missions/:id`, () => HttpResponse.json(null)),
];
