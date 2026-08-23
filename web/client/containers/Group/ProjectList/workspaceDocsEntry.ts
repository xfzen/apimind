import type { ApiResponse } from '../../../types/api';
import { hasApiData } from '../../../types/api';
import type { WorkspaceDocsProject } from '../../../reducer/modules/docs';
import type { ResolvedPromiseAction } from '../../../reducer/promiseTypes';

type EnsureWorkspaceDocsProject = (
  workspaceId: string | number
) => Promise<ResolvedPromiseAction<ApiResponse<WorkspaceDocsProject>>>;

interface OpenWorkspaceDocsProjectInput {
  workspaceId: string | number;
  page: number;
  ensure: EnsureWorkspaceDocsProject;
  refresh: (workspaceId: string | number, page: number) => unknown;
  navigate: (path: string) => void;
}

export async function openWorkspaceDocsProject(
  input: OpenWorkspaceDocsProjectInput
): Promise<ApiResponse<WorkspaceDocsProject>> {
  const action = await input.ensure(input.workspaceId);
  const response = action.payload.data;
  if (!hasApiData(response)) return response;

  await Promise.resolve(input.refresh(input.workspaceId, input.page));
  input.navigate(`/project/${response.data._id}/interface/api`);
  return response;
}
