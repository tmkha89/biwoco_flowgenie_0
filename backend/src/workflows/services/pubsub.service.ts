import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from '@google-cloud/pubsub';

/**
 * Google Cloud Pub/Sub Service
 * Manages Pub/Sub topics and subscriptions for Gmail triggers
 */
@Injectable()
export class PubSubService implements OnModuleInit {
  private readonly logger = new Logger(PubSubService.name);
  private pubsub: PubSub | null = null;
  private readonly projectId: string;
  private readonly publicApiUrl: string;
  private readonly credentialsPath: string | undefined;

  constructor(private readonly configService: ConfigService) {
    // Use GOOGLE_PROJECT_NAME first, fallback to GCP_PROJECT_ID for backward compatibility
    this.projectId = this.configService.get<string>('GOOGLE_PROJECT_NAME') || 
                     this.configService.get<string>('GCP_PROJECT_ID') || '';
    this.publicApiUrl = this.configService.get<string>('PUBLIC_API_URL') || 
                       this.configService.get<string>('FRONTEND_URL')?.replace('5173', '3000') || 
                       'http://localhost:3000';
    this.credentialsPath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
  }

  /**
   * Initialize Pub/Sub client on module init
   * This ensures logs are visible after the module is fully loaded
   */
  onModuleInit() {
    this.logger.log(`[PubSub] Initializing Pub/Sub service...`);
    this.logger.log(`[PubSub] Project ID: ${this.projectId || 'NOT SET'}`);
    this.logger.log(`[PubSub] Credentials path: ${this.credentialsPath || 'NOT SET'}`);
    this.logger.log(`[PubSub] Public API URL: ${this.publicApiUrl}`);

    // Initialize Pub/Sub client
    if (this.projectId) {
      // Only initialize if credentials are explicitly provided
      // Don't try to use default credentials (Application Default Credentials) as it fails locally
      if (this.credentialsPath) {
        try {
          this.logger.log(`[PubSub] Initializing Pub/Sub client with credentials from: ${this.credentialsPath} for project: ${this.projectId}`);
          this.pubsub = new PubSub({
            projectId: this.projectId,
            keyFilename: this.credentialsPath,
          });
          this.logger.log(`[PubSub] ✅ Pub/Sub client initialized successfully for project: ${this.projectId}`);
        } catch (error: any) {
          this.logger.error(`[PubSub] Failed to initialize Pub/Sub client: ${error.message}`);
          this.pubsub = null;
        }
      } else {
        this.logger.warn(
          `[PubSub] ⚠️ GOOGLE_APPLICATION_CREDENTIALS not set. Pub/Sub functionality disabled.\n` +
          `Please set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON key file.\n` +
          `Example: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
        );
        this.pubsub = null;
      }
    } else {
      this.logger.warn(`[PubSub] ⚠️ GOOGLE_PROJECT_NAME (or GCP_PROJECT_ID) not set, Pub/Sub functionality disabled`);
    }
  }

  /**
   * Check if Pub/Sub is available
   */
  isAvailable(): boolean {
    return this.pubsub !== null && !!this.projectId && this.projectId.trim() !== '';
  }

  /**
   * Get topic name for a user
   */
  getTopicName(userId: number): string {
    return `flowgenie-gmail-${userId}`;
  }

  /**
   * Get full topic path (projects/{projectId}/topics/{topicName})
   */
  getTopicPath(userId: number): string {
    if (!this.projectId || this.projectId.trim() === '') {
      throw new Error('GOOGLE_PROJECT_NAME (or GCP_PROJECT_ID) is not set. Cannot generate topic path.');
    }
    return `projects/${this.projectId}/topics/${this.getTopicName(userId)}`;
  }

  /**
   * Get subscription name for a user
   */
  getSubscriptionName(userId: number): string {
    return `flowgenie-gmail-sub-${userId}`;
  }

  /**
   * Get full subscription path
   */
  getSubscriptionPath(userId: number): string {
    return `projects/${this.projectId}/subscriptions/${this.getSubscriptionName(userId)}`;
  }

  /**
   * Create a Pub/Sub topic for a user
   * Returns the full topic path
   */
  async createTopic(userId: number): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Pub/Sub is not available. Please set GOOGLE_PROJECT_NAME (or GCP_PROJECT_ID) and GOOGLE_APPLICATION_CREDENTIALS');
    }

    const topicName = this.getTopicName(userId);
    const topicPath = this.getTopicPath(userId);

    this.logger.log(`[PubSub] Creating topic: ${topicName} for user ${userId}`);

    try {
      const topic = this.pubsub!.topic(topicName);
      
      // Check if topic exists first
      const [exists] = await topic.exists();
      
      if (exists) {
        this.logger.log(`[PubSub] Topic ${topicName} already exists`);
        // Grant permission even if topic already exists (in case it was created without permission)
        await this.grantGmailPublisherPermission(topicName);
        return topicPath;
      }

      // Create topic with retry logic
      const [createdTopic] = await this.retryOperation(
        () => topic.create(),
        `create topic ${topicName}`,
        3,
      );

      this.logger.log(`[PubSub] Topic ${topicName} created successfully`);

      // Grant Gmail service account publisher permission
      await this.grantGmailPublisherPermission(topicName);

      return createdTopic.name || topicPath;
    } catch (error: any) {
      // Error code 6 = AlreadyExists (from gRPC)
      if (error.code === 6 || error.message?.includes('AlreadyExists')) {
        this.logger.log(`[PubSub] Topic ${topicName} already exists (code: ${error.code})`);
        // Grant permission even if topic already exists (in case it was created without permission)
        await this.grantGmailPublisherPermission(topicName);
        return topicPath;
      }
      
      this.logger.error(`[PubSub] Failed to create topic ${topicName}:`, error.message);
      throw new Error(`Failed to create Pub/Sub topic: ${error.message}`);
    }
  }

  /**
   * Create a push subscription for a topic
   * Returns the subscription path
   */
  async createSubscription(userId: number, topicPath: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Pub/Sub is not available. Please set GOOGLE_PROJECT_NAME (or GCP_PROJECT_ID) and GOOGLE_APPLICATION_CREDENTIALS');
    }

    const subscriptionName = this.getSubscriptionName(userId);
    const subscriptionPath = this.getSubscriptionPath(userId);
    const pushEndpoint = `${this.publicApiUrl}/api/triggers/gmail`;

    this.logger.log(`[PubSub] Creating subscription: ${subscriptionName} for user ${userId}`);
    this.logger.log(`[PubSub] Push endpoint: ${pushEndpoint}`);

    try {
      const topic = this.pubsub!.topic(this.getTopicName(userId));
      
      // Check if subscription exists
      const subscription = topic.subscription(subscriptionName);
      const [exists] = await subscription.exists();
      
      if (exists) {
        this.logger.log(`[PubSub] Subscription ${subscriptionName} already exists, updating push endpoint`);
        
        // Update push endpoint if it changed
        await subscription.modifyPushConfig({
          pushEndpoint,
        });
        
        this.logger.log(`[PubSub] Subscription ${subscriptionName} updated successfully`);
        return subscriptionPath;
      }

      // Create subscription with retry logic
      const [createdSubscription] = await this.retryOperation(
        () => subscription.create({
          pushConfig: {
            pushEndpoint,
          },
          ackDeadlineSeconds: 10,
        }),
        `create subscription ${subscriptionName}`,
        3,
      );

      this.logger.log(`[PubSub] Subscription ${subscriptionName} created successfully`);
      return createdSubscription.name || subscriptionPath;
    } catch (error: any) {
      // Error code 6 = AlreadyExists
      if (error.code === 6 || error.message?.includes('AlreadyExists')) {
        this.logger.log(`[PubSub] Subscription ${subscriptionName} already exists (code: ${error.code})`);
        return subscriptionPath;
      }
      
      this.logger.error(`[PubSub] Failed to create subscription ${subscriptionName}:`, error.message);
      throw new Error(`Failed to create Pub/Sub subscription: ${error.message}`);
    }
  }

  /**
   * Check if Gmail push service account has permission to publish to topic
   * Creates the topic first if it doesn't exist
   */
  async checkGmailPushPermissions(topicPath: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    const gmailServiceAccount = 'gmail-api-push@system.gserviceaccount.com';
    
    this.logger.log(`[PubSub] Checking permissions for ${gmailServiceAccount} on topic ${topicPath}`);

    try {
      // Extract user ID from topic path: projects/{projectId}/topics/flowgenie-gmail-{userId}
      const userIdMatch = topicPath.match(/flowgenie-gmail-(\d+)/);
      if (!userIdMatch || !userIdMatch[1]) {
        this.logger.warn(`[PubSub] Could not extract user ID from topic path: ${topicPath}`);
        return false;
      }

      const userId = parseInt(userIdMatch[1], 10);
      const topicName = this.getTopicName(userId);
      const topic = this.pubsub!.topic(topicName);
      
      // Ensure topic exists before checking permissions
      const [exists] = await topic.exists();
      if (!exists) {
        this.logger.log(`[PubSub] Topic ${topicName} does not exist, creating it...`);
        await this.createTopic(userId);
        this.logger.log(`[PubSub] ✅ Topic ${topicName} created successfully`);
      }

      // Now check permissions
      const [policy] = await topic.iam.getPolicy();
      
      const hasPermission = policy.bindings.some(binding => {
        const isPublisher = binding.role === 'roles/pubsub.publisher';
        const hasServiceAccount = binding.members?.some(member => 
          member.includes(gmailServiceAccount) || member === `serviceAccount:${gmailServiceAccount}`
        );
        return isPublisher && hasServiceAccount;
      });

      if (!hasPermission) {
        this.logger.warn(
          `[PubSub] ⚠️ Gmail push service account does not have permission to publish to topic.\n` +
          `Please add IAM role: roles/pubsub.publisher to service account ${gmailServiceAccount}\n` +
          `You can do this in Google Cloud Console: IAM & Admin > IAM > Add Principal`
        );
      } else {
        this.logger.log(`[PubSub] ✅ Gmail push service account has permission to publish`);
      }

      return hasPermission;
    } catch (error: any) {
      // If topic doesn't exist, try to create it
      if (error.code === 5 || error.message?.includes('NotFound') || error.message?.includes('not found')) {
        this.logger.log(`[PubSub] Topic not found, attempting to create it...`);
        
        try {
          const userIdMatch = topicPath.match(/flowgenie-gmail-(\d+)/);
          if (userIdMatch && userIdMatch[1]) {
            const userId = parseInt(userIdMatch[1], 10);
            await this.createTopic(userId);
            this.logger.log(`[PubSub] ✅ Topic created, retrying permission check...`);
            
            // Retry permission check after creating topic
            const topicName = this.getTopicName(userId);
            const topic = this.pubsub!.topic(topicName);
            const [policy] = await topic.iam.getPolicy();
            
            const hasPermission = policy.bindings.some(binding => {
              const isPublisher = binding.role === 'roles/pubsub.publisher';
              const hasServiceAccount = binding.members?.some(member => 
                member.includes(gmailServiceAccount) || member === `serviceAccount:${gmailServiceAccount}`
              );
              return isPublisher && hasServiceAccount;
            });
            
            if (!hasPermission) {
              this.logger.warn(
                `[PubSub] ⚠️ Gmail push service account does not have permission to publish to topic.\n` +
                `Please add IAM role: roles/pubsub.publisher to service account ${gmailServiceAccount}`
              );
            } else {
              this.logger.log(`[PubSub] ✅ Gmail push service account has permission to publish`);
            }
            
            return hasPermission;
          }
        } catch (createError: any) {
          this.logger.error(`[PubSub] Failed to create topic: ${createError.message}`);
        }
      }
      
      this.logger.warn(`[PubSub] Could not check permissions: ${error.message}`);
      // Don't fail if permission check fails
      return false;
    }
  }

  /**
   * Delete a topic (and its subscriptions)
   */
  async deleteTopic(userId: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const topicName = this.getTopicName(userId);
    this.logger.log(`[PubSub] Deleting topic: ${topicName} for user ${userId}`);

    try {
      const topic = this.pubsub!.topic(topicName);
      await topic.delete();
      this.logger.log(`[PubSub] Topic ${topicName} deleted successfully`);
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NotFound')) {
        this.logger.log(`[PubSub] Topic ${topicName} does not exist`);
        return;
      }
      this.logger.error(`[PubSub] Failed to delete topic ${topicName}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(userId: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const subscriptionName = this.getSubscriptionName(userId);
    this.logger.log(`[PubSub] Deleting subscription: ${subscriptionName} for user ${userId}`);

    try {
      const topic = this.pubsub!.topic(this.getTopicName(userId));
      const subscription = topic.subscription(subscriptionName);
      await subscription.delete();
      this.logger.log(`[PubSub] Subscription ${subscriptionName} deleted successfully`);
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NotFound')) {
        this.logger.log(`[PubSub] Subscription ${subscriptionName} does not exist`);
        return;
      }
      this.logger.error(`[PubSub] Failed to delete subscription ${subscriptionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Grant Gmail service account publisher permission on a topic
   */
  private async grantGmailPublisherPermission(topicName: string): Promise<void> {
    const gmailServiceAccount = 'gmail-api-push@system.gserviceaccount.com';
    const publisherRole = 'roles/pubsub.publisher';
    const serviceAccountMember = `serviceAccount:${gmailServiceAccount}`;

    try {
      const topic = this.pubsub!.topic(topicName);
      const [policy] = await topic.iam.getPolicy();

      // Check if permission already exists
      const hasPermission = policy.bindings.some(binding => {
        const isPublisher = binding.role === publisherRole;
        const hasServiceAccount = binding.members?.some(member => 
          member === serviceAccountMember || member.includes(gmailServiceAccount)
        );
        return isPublisher && hasServiceAccount;
      });

      if (hasPermission) {
        this.logger.log(`[PubSub] Gmail service account already has publisher permission on topic ${topicName}`);
        return;
      }

      // Find existing publisher binding or create new one
      let publisherBinding = policy.bindings.find(binding => binding.role === publisherRole);
      
      if (!publisherBinding) {
        // Create new binding
        publisherBinding = {
          role: publisherRole,
          members: [serviceAccountMember],
        };
        policy.bindings.push(publisherBinding);
      } else {
        // Add to existing binding if not already present
        if (!publisherBinding.members.includes(serviceAccountMember)) {
          publisherBinding.members.push(serviceAccountMember);
        }
      }

      // Set the updated policy
      await topic.iam.setPolicy(policy);
      this.logger.log(`[PubSub] ✅ Granted ${publisherRole} permission to ${gmailServiceAccount} on topic ${topicName}`);
    } catch (error: any) {
      this.logger.error(`[PubSub] Failed to grant Gmail publisher permission: ${error.message}`);
      // Don't throw - topic creation succeeded, permission can be added manually
      this.logger.warn(
        `[PubSub] ⚠️ Please manually grant ${publisherRole} to ${gmailServiceAccount} on topic ${topicName} in Google Cloud Console`
      );
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on AlreadyExists or NotFound errors
        if (error.code === 6 || error.code === 5) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.logger.warn(
            `[PubSub] Retry ${attempt}/${maxRetries} for ${operationName} after ${delay}ms: ${error.message}`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to ${operationName} after ${maxRetries} attempts`);
  }
}

