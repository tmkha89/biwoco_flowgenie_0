import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface GmailWatchRequest {
  topicName: string;
  labelIds?: string[];
}

interface GmailWatchResponse {
  historyId: string;
  expiration: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
}

interface GmailHistoryResponse {
  history: Array<{
    messages?: Array<{
      id: string;
      threadId: string;
    }>;
    messagesAdded?: Array<{
      message: {
        id: string;
        threadId: string;
        labelIds: string[];
        snippet: string;
        historyId: string;
      };
    }>;
  }>;
}

/**
 * Service for interacting with Gmail API
 */
@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private readonly gmailApiBase = 'https://gmail.googleapis.com/gmail/v1';

  /**
   * Create a Gmail API client instance with OAuth token
   */
  private createApiClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: this.gmailApiBase,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a watch for Gmail notifications
   * Uses users().watch() API to subscribe to Gmail events
   */
  async createWatch(
    accessToken: string,
    watchRequest: GmailWatchRequest,
  ): Promise<GmailWatchResponse> {
    this.logger.log(
      `Creating Gmail watch with topic: ${watchRequest.topicName}`,
    );

    const client = this.createApiClient(accessToken);

    this.logger.log(
      `Gmail client created successfully`,
    );

    try {
      const response = await client.post(
        '/users/me/watch',
        {
          topicName: watchRequest.topicName,
          labelIds: watchRequest.labelIds || ['INBOX'],
          labelFilterAction: 'include',
        },
        {
          params: {
            access_token: accessToken,
          },
        },
      );

      this.logger.log(
        `Gmail watch created successfully, historyId: ${response.data.historyId}`,
      );
      return {
        historyId: response.data.historyId,
        expiration: response.data.expiration,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to create Gmail watch:`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Gmail watch creation failed: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  /**
   * Stop a Gmail watch
   */
  async stopWatch(accessToken: string): Promise<void> {
    this.logger.log('Stopping Gmail watch');

    const client = this.createApiClient(accessToken);

    try {
      await client.post(
        '/users/me/stop',
        {},
        {
          params: {
            access_token: accessToken,
          },
        },
      );

      this.logger.log('Gmail watch stopped successfully');
    } catch (error: any) {
      this.logger.error(
        `Failed to stop Gmail watch:`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Gmail watch stop failed: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  /**
   * Fetch new messages using history API
   */
  async fetchNewMessages(
    accessToken: string,
    historyId: string,
  ): Promise<GmailMessage[]> {
    this.logger.log(`Fetching new messages since historyId: ${historyId}`);

    const client = this.createApiClient(accessToken);

    try {
      const response = await client.get<GmailHistoryResponse>(
        '/users/me/history',
        {
          params: {
            startHistoryId: historyId,
            historyTypes: ['messageAdded'],
            maxResults: 100,
            access_token: accessToken,
          },
        },
      );

      const messages: GmailMessage[] = [];

      // Extract messages from history
      if (response.data.history) {
        for (const historyItem of response.data.history) {
          if (historyItem.messagesAdded) {
            for (const messageAdded of historyItem.messagesAdded) {
              messages.push({
                id: messageAdded.message.id,
                threadId: messageAdded.message.threadId,
                labelIds: messageAdded.message.labelIds || [],
                snippet: messageAdded.message.snippet || '',
                historyId: messageAdded.message.historyId || historyId,
              });
            }
          }
        }
      }

      this.logger.log(`Found ${messages.length} new messages`);
      return messages;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch new messages:`,
        error.response?.data || error.message,
      );
      // Return empty array instead of throwing to prevent breaking the workflow
      return [];
    }
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(accessToken: string, messageId: string): Promise<any> {
    this.logger.log(`Fetching Gmail message: ${messageId}`);

    const client = this.createApiClient(accessToken);

    try {
      const response = await client.get(`/users/me/messages/${messageId}`, {
        params: {
          format: 'full',
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch message ${messageId}:`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Failed to fetch Gmail message: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  /**
   * Renew a Gmail watch subscription
   * Gmail watch subscriptions expire after 7 days and need to be renewed
   */
  async renewWatch(
    accessToken: string,
    watchRequest: GmailWatchRequest,
  ): Promise<GmailWatchResponse> {
    this.logger.log(
      `Renewing Gmail watch with topic: ${watchRequest.topicName}`,
    );

    // First stop the existing watch
    try {
      await this.stopWatch(accessToken);
    } catch (error: any) {
      this.logger.warn(
        `Failed to stop existing watch before renewal: ${error.message}`,
      );
      // Continue anyway - createWatch will handle if needed
    }

    // Create a new watch
    return this.createWatch(accessToken, watchRequest);
  }
}
