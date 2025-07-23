import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class SlowikPokeInfraStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly pokemonTable: dynamodb.Table;
  public readonly bedrockRole: iam.Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, "PokemonUserPool", {
      userPoolName: "pokemon-user-pool",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(
      this,
      "PokemonUserPoolClient",
      {
        userPool: this.userPool,
        userPoolClientName: "pokemon-web-client",
        generateSecret: false, // For frontend applications
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
            implicitCodeGrant: true,
          },
          scopes: [
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.PROFILE,
          ],
          callbackUrls: ["http://localhost:3000", "https://localhost:3000"],
          logoutUrls: ["http://localhost:3000", "https://localhost:3000"],
        },
      }
    );

    // Output the User Pool ID and Client ID for the backend/frontend
    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "UserPoolProviderURL", {
      value: this.userPool.userPoolProviderUrl,
      description: "Cognito User Pool Provider URL (for JWT validation)",
    });

    // Create DynamoDB table for Pokemon entries
    this.pokemonTable = new dynamodb.Table(this, "PokemonEntriesTable", {
      tableName: "pokemon-entries",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "entryId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false }, // Optional: disable for cost savings in dev
    });

    // Add Global Secondary Index for category-based queries
    this.pokemonTable.addGlobalSecondaryIndex({
      indexName: "CategoryIndex",
      partitionKey: {
        name: "userCategory",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "createdAt",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the table name and ARN
    new cdk.CfnOutput(this, "PokemonTableName", {
      value: this.pokemonTable.tableName,
      description: "Pokemon entries table name",
    });

    new cdk.CfnOutput(this, "PokemonTableArn", {
      value: this.pokemonTable.tableArn,
      description: "Pokemon entries table ARN",
    });

    // Create IAM role for Bedrock on-demand access
    this.bedrockRole = new iam.Role(this, "BedrockExecutionRole", {
      roleName: "pokemon-bedrock-execution-role",
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        new iam.ServicePrincipal("lambda.amazonaws.com")
      ),
      inlinePolicies: {
        BedrockInvokeModel: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
              ],
              resources: [
                "arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0",
              ],
            }),
          ],
        }),
      },
    });

    // Output Bedrock configuration
    new cdk.CfnOutput(this, "BedrockRoleArn", {
      value: this.bedrockRole.roleArn,
      description: "IAM Role ARN for Bedrock on-demand access",
    });

    cdk.Tags.of(this).add("Caylent:Owner", "john.slowik@caylent.com");
  }
}
