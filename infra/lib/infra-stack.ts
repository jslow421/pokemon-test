import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class SlowikPokeInfraStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

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

    cdk.Tags.of(this).add("Caylent:Owner", "john.slowik@caylent.com");
  }
}
