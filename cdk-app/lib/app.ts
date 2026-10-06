#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { AppStage } from '../lib/app-stage';
import { devConfig, prdConfig } from '../lib/config';

const app = new App();

for (const config of [devConfig, prdConfig]) {
  new AppStage(app, config.stageName, {
    env: { account: config.account, region: config.region },
    config,
  });
}