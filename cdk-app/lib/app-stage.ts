import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AwsSolutionsChecks } from 'cdk-nag';
import { EnvConfig } from './config';
import { AppStack } from './app-stack';

export interface AppStageProps extends StageProps {
  config: EnvConfig;
}

export class AppStage extends Stage {
  constructor(scope: Construct, id: string, props: AppStageProps) {
    super(scope, id, props);
    new AppStack(this, 'App', { config: props.config });
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));
  }
}