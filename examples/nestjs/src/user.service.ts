import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(page: number, limit: number): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return users.map(this.toDto);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.toDto(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = this.userRepository.create(dto);
    const saved = await this.userRepository.save(user);
    return this.toDto(saved);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.userRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  private toDto(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
