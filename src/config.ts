import { getOctokit } from "@actions/github";

export function githubToken(): string {
    let token = process.env.PERSONAL_ACCESS_TOKEN;
    if (!token)
        token = process.env.GITHUB_TOKEN;
    if (!token)
        throw ReferenceError('No token defined in the environment variables');
    return token;
}

export const toolkit = getOctokit(githubToken())