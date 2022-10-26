#!/bin/bash
cd circuits
circom semaphore.circom --r1cs --wasm --sym --c
npx snarkjs powersoftau new bn128 16 pot16_0000.ptau -v
npx snarkjs powersoftau contribute pot16_0000.ptau pot16_0001.ptau --name="First contribution" -v
npx snarkjs powersoftau prepare phase2 pot16_0001.ptau pot16_final.ptau -v
npx snarkjs groth16 setup semaphore.r1cs pot16_final.ptau semaphore_0000.zkey
npx snarkjs zkey contribute semaphore_0000.zkey semaphore_0001.zkey --name="1st Contributor Name" -v
npx snarkjs zkey export verificationkey semaphore_0001.zkey verification_key.json
npx snarkjs zkey export solidityverifier semaphore_0001.zkey verifier.sol