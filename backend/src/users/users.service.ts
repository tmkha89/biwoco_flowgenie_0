import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  async createUser(data: {
    username?: string;
    email?: string;
    name?: string;
    avatar?: string;
    password?: string;
  }): Promise<User> {
    return this.usersRepository.create(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async updateUser(
    id: number,
    data: {
      name?: string;
      avatar?: string;
      password?: string;
      googleLinked?: boolean;
    },
  ): Promise<User> {
    const updateData: Record<string, any> = {};

    if (data.name) updateData.name = data.name;
    if (data.avatar) updateData.avatar = data.avatar;
    if (data.googleLinked !== undefined)
      updateData.googleLinked = data.googleLinked;

    if (data.password && data.password.trim() !== '') {
      updateData.password = data.password;
    }

    return this.usersRepository.update(id, updateData);
  }

  async createOrUpdate(data: {
    username?: string;
    email?: string;
    name?: string;
    avatar?: string;
    password?: string;
    googleLinked?: boolean;
  }): Promise<User> {
    const updateData: Record<string, any> = {};
    if (data.name) updateData.name = data.name;
    if (data.avatar) updateData.avatar = data.avatar;
    if (data.googleLinked !== undefined)
      updateData.googleLinked = data.googleLinked;

    if (data.password && data.password.trim() !== '') {
      updateData.password = data.password;
    }

    // Determine where clause: prefer username if provided, otherwise email
    const whereClause: any = {};
    if (data.username) {
      whereClause.username = data.username;
    } else if (data.email) {
      whereClause.email = data.email;
    } else {
      throw new Error('Either username or email must be provided');
    }

    return this.usersRepository.upsert({
      where: whereClause,
      create: data,
      update: updateData,
    });
  }
}
