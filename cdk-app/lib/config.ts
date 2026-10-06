mport { RemovalPolicy } from 'aws-cdk-lib';

export interface EnvConfig {
  stageName: 'dev' | 'prd';
  account: string;
  region: string;
  removalPolicy: RemovalPolicy;
  lambdaMemoryMb: number;
  maxReceiveCount: number;
  lambdaMaxConcurrency: number;
}

export const devConfig: EnvConfig = {
  stageName: 'dev',
  account: '111111111111',
  region: 'ap-northeast-1',
  removalPolicy: RemovalPolicy.DESTROY,
  lambdaMemoryMb: 256,
  maxReceiveCount: 3,
  lambdaMaxConcurrency: 2,
};

export const prdConfig: EnvConfig = {
  stageName: 'prd',
  account: '222222222222',
  region: 'ap-northeast-1',
  removalPolicy: RemovalPolicy.RETAIN,
  lambdaMemoryMb: 512,
  maxReceiveCount: 5,
  lambdaMaxConcurrency: 10,
};