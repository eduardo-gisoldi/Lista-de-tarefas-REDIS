const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const redis = require("redis");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Conectar ao Redis
const redisClient = redis.createClient();

redisClient.on("error", (err) => {
  console.error("Erro ao conectar ao Redis:", err);
});

// Inicializar a lista de tarefas (caso não exista no Redis)
redisClient.lrange("tarefas", 0, -1, (err, tasks) => {
  if (err) {
    console.error("Erro ao buscar tarefas do Redis:", err);
  } else if (tasks.length === 0) {
    // Se não houver tarefas, adiciona tarefas iniciais
    const tarefasIniciais = [
      "Lavar a louça",
      "Passar o aspirador",
      "Limpar o banheiro",
      "Organizar as compras",
      "Cozinhar o almoço"
    ];
    tarefasIniciais.forEach(task => {
      redisClient.lpush("tarefas", task);
    });
  }
});

// Configurar o diretório estático para o frontend
app.use(express.static("public"));

// Socket.io para comunicação em tempo real
io.on("connection", (socket) => {
  console.log("Novo cliente conectado");

  // Envia a lista de tarefas quando um novo cliente se conecta
  redisClient.lrange("tarefas", 0, -1, (err, tasks) => {
    if (err) {
      console.error("Erro ao buscar tarefas do Redis:", err);
    } else {
      socket.emit("update-tasks", tasks);
    }
  });

  // Adiciona uma nova tarefa
  socket.on("add-task", (task) => {
    redisClient.lpush("tarefas", task, (err) => {
      if (err) {
        console.error("Erro ao adicionar tarefa no Redis:", err);
      } else {
        // Envia a lista atualizada para todos os clientes
        redisClient.lrange("tarefas", 0, -1, (err, tasks) => {
          if (err) {
            console.error("Erro ao buscar tarefas do Redis:", err);
          } else {
            io.emit("update-tasks", tasks);
          }
        });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
