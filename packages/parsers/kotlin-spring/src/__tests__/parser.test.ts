import { describe, it, expect } from 'vitest';
import { kotlinSpringParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'kotlin' };
}

describe('kotlin-spring parser', () => {
  const parser = kotlinSpringParser();

  it('has correct name', () => {
    expect(parser.name).toBe('kotlin-spring');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.kt', '**/*.kts']);
  });

  it('parses REST endpoints from controller', async () => {
    const content = `
@RestController
@RequestMapping("/api/users")
class UserController(private val userService: UserService) {
    @GetMapping("")
    fun getUsers(): List<User> {
        return userService.getAll()
    }

    @PostMapping("")
    fun createUser(@RequestBody user: User): User {
        return userService.create(user)
    }

    @GetMapping("/{id}")
    fun getUserById(@PathVariable id: Long): User {
        return userService.findById(id)
    }
}`;
    const files = [createFile('UserController.kt', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(3);

    const getEndpoint = result.endpoints![0];
    expect(getEndpoint.httpMethod).toBe('GET');
    expect(getEndpoint.path).toBe('/api/users');
    expect(getEndpoint.handler).toBe('getUsers');
    expect(getEndpoint.returnType).toBe('List<User>');
    expect(getEndpoint.serviceRef).toBe('UserService');

    const getByIdEndpoint = result.endpoints!.find(e => e.path.includes('{id}'));
    expect(getByIdEndpoint?.path).toBe('/api/users/{id}');
    expect(getByIdEndpoint?.parameters![0].name).toBe('id');
    expect(getByIdEndpoint?.parameters![0].location).toBe('path');

    const postEndpoint = result.endpoints!.find(e => e.httpMethod === 'POST');
    expect(postEndpoint?.httpMethod).toBe('POST');
    expect(postEndpoint?.parameters).toBeDefined();
    if (postEndpoint?.parameters && postEndpoint.parameters.length > 0) {
      expect(postEndpoint.parameters[0].name).toBe('user');
      expect(postEndpoint.parameters[0].location).toBe('body');
    }
  });

  it('parses JPA entities', async () => {
    const content = `
@Entity
@Table(name = "users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_name", nullable = false)
    val name: String,

    @Column(nullable = true)
    val email: String?,

    @OneToMany(mappedBy = "user")
    val posts: List<Post> = emptyList()
)`;
    const files = [createFile('User.kt', content)];
    const result = await parser.parse(files);

    expect(result.entities).toBeDefined();
    expect(result.entities!.length).toBe(1);

    const entity = result.entities![0];
    expect(entity.name).toBe('User');
    expect(entity.tableName).toBe('users');
    expect(entity.dbType).toBe('MySQL');
    expect(entity.columns.length).toBeGreaterThan(0);

    const idColumn = entity.columns.find(c => c.name === 'id');
    expect(idColumn?.primaryKey).toBe(true);

    const nameColumn = entity.columns.find(c => c.name === 'name');
    expect(nameColumn?.dbColumnName).toBe('user_name');
    expect(nameColumn?.nullable).toBe(false);

    expect(entity.relations.length).toBe(1);
    expect(entity.relations[0].type).toBe('OneToMany');
    expect(entity.relations[0].target).toBe('Post');
  });

  it('parses services', async () => {
    const content = `
@Service
class UserService(
    private val userRepository: UserRepository,
    private val emailService: EmailService
) {
    fun getAll(): List<User> {
        return userRepository.findAll()
    }

    fun create(user: User): User {
        val saved = userRepository.save(user)
        emailService.sendWelcome(saved.email)
        return saved
    }

    fun findById(id: Long): User {
        return userRepository.findById(id).orElseThrow()
    }
}`;
    const files = [createFile('UserService.kt', content)];
    const result = await parser.parse(files);

    expect(result.services).toBeDefined();
    expect(result.services!.length).toBe(1);

    const service = result.services![0];
    expect(service.name).toBe('UserService');
    expect(service.methods).toContain('getAll');
    expect(service.methods).toContain('create');
    expect(service.methods).toContain('findById');
    expect(service.dependencies).toContain('UserRepository');
    expect(service.dependencies).toContain('EmailService');

    expect(result.dependencies).toBeDefined();
    expect(result.dependencies!.length).toBe(2);
  });

  it('parses data classes as types', async () => {
    const content = `
data class UserDTO(
    val id: Long,
    val name: String,
    val email: String?
)

data class CreateUserInput(
    val name: String,
    val email: String
)

data class UserResponse(
    val id: Long,
    val name: String,
    val createdAt: String
)`;
    const files = [createFile('UserTypes.kt', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBe(3);

    const dto = result.types!.find(t => t.name === 'UserDTO');
    expect(dto?.kind).toBe('response'); // DTO ends with 'Response' pattern in inferTypeKind
    expect(dto?.fields.length).toBe(3);
    expect(dto?.fields[0].name).toBe('id');
    expect(dto?.fields[0].type).toBe('Long');
    expect(dto?.fields[2].required).toBe(false);

    const input = result.types!.find(t => t.name === 'CreateUserInput');
    expect(input?.kind).toBe('input');

    const response = result.types!.find(t => t.name === 'UserResponse');
    expect(response?.kind).toBe('response');
  });

  it('parses DGS GraphQL operations when framework detection enabled', async () => {
    const content = `
@DgsComponent
class UserFetcher(private val userService: UserService) {
    @DgsQuery
    fun users(): List<User> {
        return userService.getAll()
    }

    @DgsMutation
    fun createUser(@InputArgument input: CreateUserInput): User {
        return userService.create(input)
    }
}`;
    const files = [createFile('UserFetcher.kt', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(2);

    const query = result.endpoints![0];
    expect(query.protocol).toBe('graphql');
    expect(query.operationType).toBe('Query');
    expect(query.fieldName).toBe('users');

    const mutation = result.endpoints![1];
    expect(mutation.protocol).toBe('graphql');
    expect(mutation.operationType).toBe('Mutation');
    expect(mutation.fieldName).toBe('createUser');
  });
});
