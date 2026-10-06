import { Duration } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export interface QueueWithDlqProps {
  queueName: string;
  visibilityTimeout: Duration;
  maxReceiveCount?: number;
}

export class QueueWithDlq extends Construct {
  public readonly queue: sqs.Queue;
  public readonly dlq: sqs.Queue;
  public readonly dlqAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: QueueWithDlqProps) {
    super(scope, id);

    this.dlq = new sqs.Queue(this, 'Dlq', {
      queueName: `${props.queueName}-dlq`,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });

    this.queue = new sqs.Queue(this, 'Queue', {
      queueName: props.queueName,
      visibilityTimeout: props.visibilityTimeout,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: props.maxReceiveCount ?? 3,
      },
    });

    this.dlqAlarm = new cloudwatch.Alarm(this, 'DlqAlarm', {
      metric: this.dlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    NagSuppressions.addResourceSuppressions(this.dlq, [
      { id: 'AwsSolutions-SQS3', reason: 'This queue is itself the DLQ.' },
    ]);
  }
}