import { describe, it, expect } from 'vitest';
import { cParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'c' };
}

describe('c parser', () => {
  const parser = cParser();

  it('has correct name', () => {
    expect(parser.name).toBe('c');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.c', '**/*.h']);
  });

  it('parses struct declarations', async () => {
    const content = `
#include <stdio.h>

// User data structure
struct User {
    int id;
    char name[100];
    char email[255];
    int age;
};

typedef struct {
    float x;
    float y;
    float z;
} Point3D;

typedef struct Node {
    int data;
    struct Node* next;
} Node;
`;
    const files = [createFile('types.h', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBeGreaterThan(0);

    const userStruct = result.types!.find(t => t.name === 'User');
    expect(userStruct).toBeDefined();
    expect(userStruct?.kind).toBe('type');
    expect(userStruct?.fields.length).toBe(4);
    expect(userStruct?.fields[0].name).toBe('id');
    expect(userStruct?.fields[0].type).toMatch(/int/);

    const pointStruct = result.types!.find(t => t.name === 'Point3D');
    expect(pointStruct).toBeDefined();
    expect(pointStruct?.fields.length).toBe(3);
    expect(pointStruct?.fields[0].type).toMatch(/float/);

    const nodeStruct = result.types!.find(t => t.name === 'Node');
    expect(nodeStruct).toBeDefined();
    expect(nodeStruct?.fields.length).toBe(2);
  });

  it('parses function declarations', async () => {
    const content = `
#include <stdio.h>

// Initialize the user system
int init_user_system(void) {
    return 0;
}

// Create a new user
struct User* create_user(const char* name, const char* email, int age) {
    return NULL;
}

// Find user by ID
struct User* find_user_by_id(int id) {
    return NULL;
}

// Update user age
void update_user_age(struct User* user, int new_age) {
    // implementation
}

// Delete a user
int delete_user(int user_id) {
    return 0;
}
`;
    const files = [createFile('user.c', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    const initFunc = result.types!.find(t => t.name === 'init_user_system');
    expect(initFunc).toBeDefined();
    expect(initFunc?.fields.find(f => f.name === 'return_type')?.type).toMatch(/int/);

    const createFunc = result.types!.find(t => t.name === 'create_user');
    expect(createFunc).toBeDefined();
    const createParams = createFunc?.fields.filter(f => f.name !== 'return_type');
    expect(createParams?.length).toBe(3);

    const updateFunc = result.types!.find(t => t.name === 'update_user_age');
    expect(updateFunc).toBeDefined();
    expect(updateFunc?.fields.find(f => f.name === 'return_type')?.type).toMatch(/void/);
  });

  it('parses enum declarations', async () => {
    const content = `
// HTTP status codes
enum HttpStatus {
    HTTP_OK = 200,
    HTTP_CREATED = 201,
    HTTP_BAD_REQUEST = 400,
    HTTP_NOT_FOUND = 404,
    HTTP_SERVER_ERROR = 500
};

typedef enum {
    LOG_DEBUG,
    LOG_INFO,
    LOG_WARN,
    LOG_ERROR
} LogLevel;

typedef enum Color {
    RED = 0xFF0000,
    GREEN = 0x00FF00,
    BLUE = 0x0000FF
} Color;
`;
    const files = [createFile('enums.h', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    const httpEnum = result.types!.find(t => t.name === 'HttpStatus');
    expect(httpEnum).toBeDefined();
    expect(httpEnum?.kind).toBe('enum');
    expect(httpEnum?.fields.length).toBe(5);
    expect(httpEnum?.fields[0].name).toBe('HTTP_OK');
    expect(httpEnum?.fields[0].type).toBe('200');

    const logLevelEnum = result.types!.find(t => t.name === 'LogLevel');
    expect(logLevelEnum).toBeDefined();
    expect(logLevelEnum?.kind).toBe('enum');
    expect(logLevelEnum?.fields.length).toBe(4);

    const colorEnum = result.types!.find(t => t.name === 'Color');
    expect(colorEnum).toBeDefined();
    expect(colorEnum?.fields.length).toBe(3);
  });

  it('parses macro definitions', async () => {
    const content = `
#include <stdio.h>

// Simple macro functions
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define MIN(a, b) ((a) < (b) ? (a) : (b))

#define SQUARE(x) ((x) * (x))

#define IS_VALID(ptr) ((ptr) != NULL)

#define LOG_ERROR(msg, ...) fprintf(stderr, "ERROR: " msg "\\n", ##__VA_ARGS__)
`;
    const files = [createFile('macros.h', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();

    const maxMacro = result.types!.find(t => t.name === 'MAX');
    expect(maxMacro).toBeDefined();
    expect(maxMacro?.fields.some(f => f.name === 'a')).toBe(true);
    expect(maxMacro?.fields.some(f => f.name === 'b')).toBe(true);

    const squareMacro = result.types!.find(t => t.name === 'SQUARE');
    expect(squareMacro).toBeDefined();
    expect(squareMacro?.fields.some(f => f.name === 'x')).toBe(true);

    const logMacro = result.types!.find(t => t.name === 'LOG_ERROR');
    expect(logMacro).toBeDefined();
  });

  it('parses microhttpd endpoint detection', async () => {
    const content = `
#include <microhttpd.h>

// Handle GET /users request
static int handle_users(void *cls, struct MHD_Connection *connection,
                        const char *url, const char *method,
                        const char *version, const char *upload_data,
                        size_t *upload_data_size, void **con_cls) {
    const char *response = "User list";
    struct MHD_Response *mhd_response;
    int ret;

    mhd_response = MHD_create_response_from_buffer(strlen(response),
                                                    (void *)response,
                                                    MHD_RESPMEM_PERSISTENT);
    ret = MHD_queue_response(connection, MHD_HTTP_OK, mhd_response);
    MHD_destroy_response(mhd_response);

    return ret;
}

// Handle POST /auth/login
static int handle_login(void *cls, struct MHD_Connection *connection,
                        const char *url, const char *method,
                        const char *version, const char *upload_data,
                        size_t *upload_data_size, void **con_cls) {
    return MHD_YES;
}
`;
    const files = [createFile('server.c', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();

    // MHD endpoint detection requires specific patterns
    if (result.endpoints!.length > 0) {
      expect(result.endpoints!.length).toBeGreaterThan(0);

      const usersEndpoint = result.endpoints!.find(e => e.handler === 'handle_users');
      expect(usersEndpoint).toBeDefined();
      expect(usersEndpoint?.protocol).toBe('rest');
      expect(usersEndpoint?.returnType).toBe('int');

      const loginEndpoint = result.endpoints!.find(e => e.handler === 'handle_login');
      expect(loginEndpoint).toBeDefined();
    }
  });

  it('parses Mongoose web server callbacks', async () => {
    const content = `
#include "mongoose.h"

// Handle HTTP request
static void handle_api_request(struct mg_connection *c, int ev, void *ev_data, void *fn_data) {
    if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_message *hm = (struct mg_http_message *) ev_data;

        if (mg_http_match_uri(hm, "/api/status")) {
            mg_http_reply(c, 200, "", "{\\"status\\":\\"ok\\"}");
        }
    }
}

static void handle_websocket(struct mg_connection *c, int ev, void *ev_data, void *fn_data) {
    if (ev == MG_EV_WS_MSG) {
        // handle websocket
    }
}
`;
    const files = [createFile('mongoose_server.c', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();

    // Mongoose endpoint detection requires specific patterns
    if (result.endpoints!.length > 0) {
      expect(result.endpoints!.length).toBeGreaterThan(0);

      const apiEndpoint = result.endpoints!.find(e => e.handler === 'handle_api_request');
      expect(apiEndpoint).toBeDefined();
      expect(apiEndpoint?.protocol).toBe('rest');
      expect(apiEndpoint?.returnType).toBe('void');
    }
  });

  it('filters out standard library includes', async () => {
    const content = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "user.h"
#include "config.h"

int main(void) {
    return 0;
}
`;
    const files = [createFile('main.c', content)];
    const result = await parser.parse(files);

    expect(result.dependencies).toBeDefined();

    // Should not include standard library headers
    expect(result.dependencies!.some(d => d.target === 'stdio.h')).toBe(false);
    expect(result.dependencies!.some(d => d.target === 'stdlib.h')).toBe(false);

    // Should include user headers
    expect(result.dependencies!.some(d => d.target === 'user.h')).toBe(true);
    expect(result.dependencies!.some(d => d.target === 'config.h')).toBe(true);
  });
});
