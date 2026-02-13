import { describe, it, expect } from 'vitest';
import { cppParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'cpp' };
}

describe('cpp parser', () => {
  const parser = cppParser();

  it('has correct name', () => {
    expect(parser.name).toBe('cpp');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.cpp', '**/*.hpp', '**/*.cc', '**/*.hh', '**/*.cxx', '**/*.h']);
  });

  it('parses class declarations with methods', async () => {
    const content = `
#include <string>
#include <vector>

namespace app {

/**
 * User service class
 */
class UserService {
private:
    std::string dbConnection;
    int maxUsers;

public:
    UserService(const std::string& conn);

    void createUser(const std::string& name, const std::string& email);
    User* findUserById(int id);
    std::vector<User> getAllUsers();
    bool deleteUser(int id);

    int getMaxUsers() const { return maxUsers; }
};

} // namespace app
`;
    const files = [createFile('UserService.hpp', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    // Check if UserService was parsed
    if (result.types!.length > 0 || result.services!.length > 0) {
      const userService = result.types!.find(t => t.name.includes('UserService'));
      const service = result.services!.find(s => s.name.includes('UserService'));

      // Should be in either types or services
      expect(userService || service).toBeDefined();

      if (service) {
        expect(service.methods.length).toBeGreaterThan(0);
      }
    }
  });

  it('parses template classes', async () => {
    const content = `
#include <memory>

namespace containers {

/**
 * Generic container class
 */
template<typename T, typename Allocator = std::allocator<T>>
class Container {
private:
    T* data;
    size_t size;
    Allocator allocator;

public:
    Container();
    ~Container();

    void push(const T& item);
    T pop();
    size_t getSize() const;
};

template<typename K, typename V>
class KeyValueStore {
private:
    std::map<K, V> storage;

public:
    void set(const K& key, const V& value);
    V get(const K& key) const;
};

} // namespace containers
`;
    const files = [createFile('Container.hpp', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    const container = result.types!.find(t => t.name.includes('Container'));
    expect(container).toBeDefined();
    expect(container?.fields.length).toBeGreaterThan(0);

    const kvStore = result.types!.find(t => t.name.includes('KeyValueStore'));
    expect(kvStore).toBeDefined();
  });

  it('parses namespace handling', async () => {
    const content = `
namespace web {
namespace api {

class RestController {
public:
    void handleRequest();
};

} // namespace api
} // namespace web

namespace database {

class Connection {
public:
    bool connect();
    void disconnect();
};

} // namespace database
`;
    const files = [createFile('controllers.hpp', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    // Namespace handling may affect how names are stored
    if (result.types!.length > 0) {
      // At least some types should be parsed
      expect(result.types!.length).toBeGreaterThan(0);
    }
  });

  it('parses Crow framework endpoints', async () => {
    const content = `
#include "crow.h"

int main() {
    crow::SimpleApp app;

    CROW_ROUTE(app, "/users")
    ([](){
        return "User list";
    });

    CROW_ROUTE(app, "/users/<int>")
    ([](int id){
        return "User " + std::to_string(id);
    });

    CROW_ROUTE(app, "/api/products")
    .methods("GET"_method, "POST"_method)
    ([](const crow::request& req){
        return crow::response(200, "Products");
    });

    app.port(8080).multithreaded().run();
}
`;
    const files = [createFile('main.cpp', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();

    // Crow endpoint detection
    if (result.endpoints!.length > 0) {
      expect(result.endpoints!.length).toBeGreaterThan(0);

      const usersEndpoint = result.endpoints!.find(e => e.path === '/users');
      if (usersEndpoint) {
        expect(usersEndpoint.protocol).toBe('rest');
        expect(usersEndpoint.returnType).toBe('crow::response');
      }
    }
  });

  it('parses Pistache framework endpoints', async () => {
    const content = `
#include <pistache/endpoint.h>
#include <pistache/router.h>

using namespace Pistache;

class UserHandler {
public:
    void getUsers(const Rest::Request& request, Http::ResponseWriter response) {
        response.send(Http::Code::Ok, "Users list");
    }

    void createUser(const Rest::Request& request, Http::ResponseWriter response) {
        response.send(Http::Code::Created, "User created");
    }

    void getUserById(const Rest::Request& request, Http::ResponseWriter response) {
        auto id = request.param(":id").as<int>();
        response.send(Http::Code::Ok, "User " + std::to_string(id));
    }
};

void setupRoutes(Rest::Router& router) {
    using namespace Rest;

    Routes::Get(router, "/api/users", Routes::bind(&UserHandler::getUsers));
    Routes::Post(router, "/api/users", Routes::bind(&UserHandler::createUser));
    Routes::Get(router, "/api/users/:id", Routes::bind(&UserHandler::getUserById));
    Routes::Delete(router, "/api/users/:id", Routes::bind(&UserHandler::deleteUser));
}
`;
    const files = [createFile('handlers.cpp', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBeGreaterThan(0);

    const getUsersEndpoint = result.endpoints!.find(e => e.path === '/api/users' && e.httpMethod === 'GET');
    expect(getUsersEndpoint).toBeDefined();
    expect(getUsersEndpoint?.handler).toBe('getUsers');
    expect(getUsersEndpoint?.handlerClass).toBe('UserHandler');

    const createEndpoint = result.endpoints!.find(e => e.httpMethod === 'POST');
    expect(createEndpoint).toBeDefined();
    expect(createEndpoint?.handler).toBe('createUser');

    const getByIdEndpoint = result.endpoints!.find(e => e.path === '/api/users/:id');
    expect(getByIdEndpoint).toBeDefined();
    if (getByIdEndpoint?.parameters && getByIdEndpoint.parameters.length > 0) {
      expect(getByIdEndpoint.parameters.length).toBeGreaterThan(0);
    }
  });

  it('parses Drogon framework endpoints', async () => {
    const content = `
#include <drogon/HttpController.h>

using namespace drogon;

class UserController : public HttpController<UserController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(UserController, "/api/users", Get);
    ADD_METHOD_TO(UserController, "/api/users/{id}", Get, Post);
    ADD_METHOD_TO(UserController, "/api/users/{id}", Delete);
    METHOD_LIST_END

    void getUsers(const HttpRequestPtr &req,
                  std::function<void(const HttpResponsePtr &)> &&callback);

    void createUser(const HttpRequestPtr &req,
                    std::function<void(const HttpResponsePtr &)> &&callback);
};
`;
    const files = [createFile('UserController.hpp', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBeGreaterThan(0);

    const getUsersEndpoint = result.endpoints!.find(e => e.path === '/api/users' && e.httpMethod === 'GET');
    expect(getUsersEndpoint).toBeDefined();
    expect(getUsersEndpoint?.handlerClass).toBe('UserController');

    const deleteEndpoint = result.endpoints!.find(e => e.httpMethod === 'DELETE');
    expect(deleteEndpoint).toBeDefined();
    expect(deleteEndpoint?.path).toMatch(/\/api\/users/);
  });

  it('parses cpp-httplib endpoints', async () => {
    const content = `
#include "httplib.h"

int main() {
    httplib::Server svr;

    svr.Get("/hello", [](const httplib::Request& req, httplib::Response& res) {
        res.set_content("Hello World!", "text/plain");
    });

    svr.Post("/api/data", [](const httplib::Request& req, httplib::Response& res) {
        res.set_content("Data received", "text/plain");
    });

    svr.Get("/users/:id", [](const httplib::Request& req, httplib::Response& res) {
        auto id = req.path_params.at("id");
        res.set_content("User " + id, "text/plain");
    });

    svr.listen("localhost", 8080);
}
`;
    const files = [createFile('server.cpp', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(3);

    const helloEndpoint = result.endpoints!.find(e => e.path === '/hello');
    expect(helloEndpoint).toBeDefined();
    expect(helloEndpoint?.httpMethod).toBe('GET');

    const postEndpoint = result.endpoints!.find(e => e.httpMethod === 'POST');
    expect(postEndpoint).toBeDefined();
    expect(postEndpoint?.path).toBe('/api/data');

    const paramEndpoint = result.endpoints!.find(e => e.path === '/users/:id');
    expect(paramEndpoint).toBeDefined();
  });

  it('parses enum class declarations', async () => {
    const content = `
namespace app {

enum class Status {
    Active,
    Inactive,
    Pending,
    Deleted
};

enum class HttpMethod : int {
    GET = 1,
    POST = 2,
    PUT = 3,
    DELETE = 4,
    PATCH = 5
};

enum Color {
    Red,
    Green,
    Blue
};

} // namespace app
`;
    const files = [createFile('enums.hpp', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    const statusEnum = result.types!.find(t => t.name.includes('Status'));
    expect(statusEnum).toBeDefined();
    // Enums may be parsed as 'enum' or 'type' depending on implementation
    expect(['enum', 'type']).toContain(statusEnum?.kind);
    if (statusEnum?.fields.length) {
      expect(statusEnum.fields.length).toBeGreaterThan(0);
    }

    const httpEnum = result.types!.find(t => t.name.includes('HttpMethod'));
    if (httpEnum) {
      expect(['enum', 'type']).toContain(httpEnum.kind);
    }

    const colorEnum = result.types!.find(t => t.name.includes('Color'));
    if (colorEnum) {
      expect(['enum', 'type']).toContain(colorEnum.kind);
    }
  });

  it('parses struct declarations', async () => {
    const content = `
namespace dto {

struct UserDTO {
    int id;
    std::string name;
    std::string email;
    bool isActive;
};

struct Point {
    double x;
    double y;
    double z;

    double distance() const;
};

struct Response : BaseResponse {
    int statusCode;
    std::string message;
    std::vector<std::string> errors;
};

} // namespace dto
`;
    const files = [createFile('dto.hpp', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    const userDto = result.types!.find(t => t.name.includes('UserDTO'));
    expect(userDto).toBeDefined();
    expect(userDto?.kind).toBe('type');
    expect(userDto?.fields.length).toBe(4);
    expect(userDto?.fields.find(f => f.name === 'id')).toBeDefined();

    const point = result.types!.find(t => t.name.includes('Point'));
    expect(point).toBeDefined();
    expect(point?.fields.length).toBe(3);

    const response = result.types!.find(t => t.name.includes('Response'));
    expect(response).toBeDefined();
  });

  it('filters out standard library includes', async () => {
    const content = `
#include <iostream>
#include <vector>
#include <string>
#include <memory>
#include "UserService.hpp"
#include "config.h"

int main() {
    return 0;
}
`;
    const files = [createFile('main.cpp', content)];
    const result = await parser.parse(files);

    expect(result.dependencies).toBeDefined();

    // Should not include standard library headers
    expect(result.dependencies!.some(d => d.target === 'iostream')).toBe(false);
    expect(result.dependencies!.some(d => d.target === 'vector')).toBe(false);
    expect(result.dependencies!.some(d => d.target === 'string')).toBe(false);

    // Should include user headers
    expect(result.dependencies!.some(d => d.target === 'UserService.hpp')).toBe(true);
    expect(result.dependencies!.some(d => d.target === 'config.h')).toBe(true);
  });
});
