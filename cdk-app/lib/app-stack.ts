import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvConfig } from './config';
import { QueueWithDlq } from './constructs/queue-with-dlq';

export interface AppStackProps extends StackProps {
  config: EnvConfig;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const { config } = props;

    const table = new dynamodb.Table(this, 'OrderTable', {
      tableName: `${config.stageName}-orders`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: config.removalPolicy,
    });

    const fnTimeout = Duration.seconds(30);

    const ingest = new QueueWithDlq(this, 'Ingest', {
      queueName: `${config.stageName}-ingest`,
      visibilityTimeout: Duration.seconds(fnTimeout.toSeconds() * 6),
      maxReceiveCount: config.maxReceiveCount,
    });

    const logGroup = new logs.LogGroup(this, 'ConsumerLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: config.removalPolicy,
    });

    const consumer = new NodejsFunction(this, 'Consumer', {
      entry: 'lambda/consumer/index.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: fnTimeout,
      memorySize: config.lambdaMemoryMb,
      logGroup,
      environment: { TABLE_NAME: table.tableName },
    });

    consumer.addEventSource(
      new SqsEventSource(ingest.queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
        maxConcurrency: config.lambdaMaxConcurrency,
      }),
    );

    table.grantWriteData(consumer);

    NagSuppressions.addResourceSuppressions(
      consumer,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'AWSLambdaBasicExecutionRole is the minimal managed policy for CloudWatch Logs.',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
      ],
      true,
    );
  }
}