import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("deploy workflow", () => {
  it("dev/main branch deploys with modern runtimes and npm scripts", () => {
    const workflow = parse(
      readFileSync(
        resolve(__dirname, "../../../../.github/workflows/deploy.yaml"),
        "utf8",
      ),
    );

    expect(workflow.on.push.branches).toEqual(["main", "dev"]);
    expect(JSON.stringify(workflow)).toContain('node-version":"24');
    expect(JSON.stringify(workflow)).toContain('python-version":"3.13');
    expect(JSON.stringify(workflow)).toContain("npm run cdk -- deploy --all");
    expect(JSON.stringify(workflow)).toContain("VITE_ENV");
  });

  it("runs verification before any deploy job", () => {
    const workflow = parse(
      readFileSync(
        resolve(__dirname, "../../../../.github/workflows/deploy.yaml"),
        "utf8",
      ),
    );

    const jobs = workflow.jobs;
    const verifySteps = JSON.stringify(jobs.verify.steps);

    expect(jobs["deploy-cdk"].needs).toContain("verify");
    expect(verifySteps).toContain("npm ci");
    expect(verifySteps).toContain("npm run format:check");
    expect(verifySteps).toContain("npm run lint");
    expect(verifySteps).toContain("npm run type-check");
    expect(verifySteps).toContain("npm run test:unit");
    expect(verifySteps).toContain("npm run build");
    expect(verifySteps).toContain("npm run e2e");
    expect(verifySteps).toContain("npm run lambda:test");
    expect(verifySteps).toContain("npm run cdk -- synth --all");
  });
});
