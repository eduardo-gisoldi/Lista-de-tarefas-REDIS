const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const redis = require("redis");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Conectar ao Redis
const redisClient = redis.createClient({
  url: 'redis://localhost:6379' // substitua pelo URL do seu Redis se for diferente
});

redisClient.on("error", (err) => {
  console.error("Erro ao conectar ao Redis:", err);
});

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("Conectado ao Redis com sucesso.");
  } catch (err) {
    console.error("Erro ao conectar ao Redis:", err);
  }
}
connectRedis();

// Inicializar a lista de tarefas (caso não exista no Redis)
async function initializeTasks() {
  try {
    const tasks = await redisClient.lRange("tarefas", 0, -1);
    if (tasks.length === 0) {
      const tarefasIniciais = [
        "Lavar a louça",
        "Passar o aspirador",
        "Limpar o banheiro",
        "Organizar as compras",
        "Cozinhar o almoço"
      ];
      for (const task of tarefasIniciais) {
        await redisClient.rPush("tarefas", task);
      }
    }
  } catch (err) {
    console.error("Erro ao buscar ou adicionar tarefas no Redis:", err);
  }
}
initializeTasks();

// Configurar o diretório estático para o frontend
app.use(express.static("public"));

// Socket.io para comunicação em tempo real
io.on("connection", async (socket) => {
  console.log("Novo cliente conectado");

  // Envia a lista de tarefas quando um novo cliente se conecta
  try {
    const tasks = await redisClient.lRange("tarefas", 0, -1);
    socket.emit("update-tasks", tasks);
  } catch (err) {
    console.error("Erro ao buscar tarefas do Redis:", err);
  }

  // Adiciona uma nova tarefa
  socket.on("add-task", async (task) => {
    try {
      await redisClient.rPush("tarefas", task);
      const updatedTasks = await redisClient.lRange("tarefas", 0, -1);
      io.emit("update-tasks", updatedTasks);
    } catch (err) {
      console.error("Erro ao adicionar ou buscar tarefas no Redis:", err);
    }
  });

  // Deleta uma tarefa
  socket.on("delete-task", async (task) => {
    try {
      await redisClient.lRem("tarefas", 1, task); // Remove uma ocorrência da tarefa
      const updatedTasks = await redisClient.lRange("tarefas", 0, -1);
      io.emit("update-tasks", updatedTasks); // Atualiza a lista para todos os clientes
    } catch (err) {
      console.error("Erro ao deletar tarefa no Redis:", err);
    }
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
