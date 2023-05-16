function delay(timeoutInMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutInMs));
}

async function main(): Promise<void> {
  await delay(2000);
  console.log("Hello after 2 seconds");
}

console.log("Starting program...");
main()
  .then(() => console.log(`\n\nExiting program...`))
  .catch(console.error);
