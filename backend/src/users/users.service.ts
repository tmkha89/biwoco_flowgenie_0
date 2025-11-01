import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  async createUser(data: { email: string; name?: string; avatar?: string }): Promise<User> {
    return this.usersRepository.create(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async updateUser(id: number, data: { name?: string; avatar?: string }): Promise<User> {
    return this.usersRepository.update(id, data);
  }

  async createOrUpdate(data: {
    email: string;
    name?: string;
    avatar?: string;
  }): Promise<User> {
    return this.usersRepository.upsert({
      where: { email: data.email },
      create: data,
      update: { name: data.name, avatar: data.avatar },
    });
  }
}

