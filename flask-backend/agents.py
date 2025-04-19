from autogen import ConversableAgent
from autogen.coding import LocalCommandLineCodeExecutor


from config import openai_client


# Command-line code executor (for EnvSetupAgent)
executor = LocalCommandLineCodeExecutor(
    timeout=120,
    work_dir="./cli_workspace"
)


# --- Agent definitions -----------------------------------------------------
def make_env_agent(user_id):
    return ConversableAgent(
        name="EnvSetupAgent",
        system_message=(
            "You are an expert in setting up development environments via CLI. "
            "Always consult memory for user preferences. Explain your plan, then generate shell commands."
        ),
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":openai_client.api_key}]},
        code_execution_config={"executor": executor},
        human_input_mode="NEVER",
    )


def make_manager_agent(user_id):
    return ConversableAgent(
        name="ManagerAgent",
        system_message=(
            "You are a project manager AI. Coordinate agents and respect preferences."
        ),
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":openai_client.api_key}]},
        human_input_mode="NEVER",
    )


def make_bash_agent(user_id):
    return ConversableAgent(
        name="BashAgent",
        system_message=(
            "You are BashAgent. You can generate and execute shell commands, search YouTube, and open URLs."
        ),
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":openai_client.api_key}]},
        human_input_mode="NEVER",
    )


def make_human_agent(user_id):
    return ConversableAgent(
        name="UserProxy",
        human_input_mode="TERMINATE",
        max_consecutive_auto_reply=3,
    )