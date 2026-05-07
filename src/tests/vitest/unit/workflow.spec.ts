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
    expect(verifySteps).toContain("npm run cdk:test");
    expect(verifySteps).toContain(
      "python3 scripts/verify_ogp_layer_image_generation.py",
    );
    expect(verifySteps).toContain("npm run cdk -- synth --all");
  });

  it("packages Lambda functions with shared util and OGP assets", () => {
    const workflow = parse(
      readFileSync(
        resolve(__dirname, "../../../../.github/workflows/deploy.yaml"),
        "utf8",
      ),
    );

    const deployLambdaSteps = JSON.stringify(
      workflow.jobs["deploy-lambda"].steps,
    );

    expect(deployLambdaSteps).toContain("pushd");
    expect(deployLambdaSteps).toContain("backend/lambda/src/${short_name}");
    expect(deployLambdaSteps).toContain("cp ../util.py ./");
    expect(deployLambdaSteps).toContain("zip -r package.zip .");
  });

  it("runs an OGP smoke test after site and Lambda deployment", () => {
    const workflow = parse(
      readFileSync(
        resolve(__dirname, "../../../../.github/workflows/deploy.yaml"),
        "utf8",
      ),
    );
    const jobs = workflow.jobs;

    expect(jobs["deploy-cdk"].outputs).toHaveProperty(
      "DOMAIN_NAME_DISTRIBUTION",
    );
    expect(jobs["deploy-cdk"].outputs).toHaveProperty("DOMAIN_NAME_OGP");
    expect(jobs["ogp-smoke"].needs).toEqual(
      expect.arrayContaining(["deploy-cdk", "deploy-lambda", "deploy-node"]),
    );
    expect(JSON.stringify(jobs["ogp-smoke"].steps)).toContain(
      "node scripts/verify-ogp-smoke.mjs",
    );
    expect(JSON.stringify(jobs["ogp-smoke"].steps)).toContain(
      "OGP_SMOKE_BASIC_AUTH",
    );
  });
});
