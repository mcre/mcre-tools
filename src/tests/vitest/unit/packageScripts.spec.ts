import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = () =>
  JSON.parse(
    readFileSync(resolve(__dirname, "../../../../package.json"), "utf8"),
  ) as {
    scripts: Record<string, string>;
  };

describe("package scripts", () => {
  it("exposes local dev Lambda deploy and profile-backed CDK scripts", () => {
    const scripts = packageJson().scripts;

    expect(scripts["lambda:deploy:dev"]).toBe(
      "bash tools/deploy_lambda_dev.sh",
    );
    expect(scripts["build:dev"]).toContain("tools-api-dev.mcre.info");
    expect(scripts["build:dev"]).not.toContain("VITE_REALTIME_WS_URL");
    expect(scripts["build:dev"]).not.toContain("tools-ws-dev.mcre.info");
    expect(scripts["preview:dev"]).toBe("npm run build:dev && npm run preview");
    expect(scripts["cdk:synth:dev"]).toContain("--profile mcre-main");
    expect(scripts["cdk:diff:dev"]).toContain("--profile mcre-main");
    expect(scripts["cdk:deploy:dev"]).toContain("--profile mcre-main");
    expect(scripts["cdk:synth:prod"]).toContain("--profile mcre-main");
    expect(scripts["cdk:diff:prod"]).toContain("--profile mcre-main");
    expect(scripts["cdk:deploy:prod"]).toContain("--profile mcre-main");
  });
});
