import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import type { GitHubProfile } from '../interfaces/github-profile.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Create or update a user from their GitHub profile and access token.
   * Returns the upserted user.
   */
  async upsertFromGitHub(
    profile: GitHubProfile,
    accessToken: string,
  ): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: { githubId: String(profile.id) },
    });

    if (existing) {
      existing.username = profile.login;
      existing.displayName = profile.name;
      existing.email = profile.email;
      existing.avatarUrl = profile.avatar_url;
      existing.accessToken = accessToken;
      return this.userRepo.save(existing);
    }

    const user = this.userRepo.create({
      githubId: String(profile.id),
      username: profile.login,
      displayName: profile.name,
      email: profile.email,
      avatarUrl: profile.avatar_url,
      accessToken: accessToken,
    });

    return this.userRepo.save(user);
  }

  /**
   * Find a user by their primary key (UUID).
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
